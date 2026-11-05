import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createAuthentication } from "../server/auth.js";
import { createApp } from "../server/app.js";
import { createLedger } from "../server/ledger.js";
import {
  amountInput,
  parseAmount,
  todayIn,
  validDate,
  type Expense,
  type ExpenseList,
  type Workspace,
} from "../src/lib/ledger.js";

const origin = "http://localhost:3000";
async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "expense-ledger-"));
  const config = {
    databasePath: join(directory, "ledger.sqlite"),
    secret: randomBytes(32).toString("base64url"),
    baseURL: origin,
  };
  const { auth, database } = await createAuthentication(config);
  const server = createApp(auth, database).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });
  async function signup(email: string) {
    const response = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        name: "Ledger Test",
        email,
        password: "a memorable test password",
      }),
    });
    assert.equal(response.status, 200);
    return response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }
  const cookie = await signup("ledger@example.com");
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    options: { cookie?: string; origin?: string; key?: string } = {},
  ) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: options.origin ?? origin,
        Cookie: options.cookie ?? cookie,
        "Idempotency-Key": options.key ?? randomUUID(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function setup(currency = "GBP", session = cookie) {
    const response = await request(
      "/workspace",
      "PUT",
      { currency, timezone: "Europe/London" },
      { cookie: session },
    );
    assert.equal(response.status, 200, await response.clone().text());
    return response.json() as Promise<Workspace>;
  }
  const values = (categoryId: string, amount = "12.34") => ({
    amount,
    date: "2026-10-28",
    categoryId,
    merchant: "Weekly groceries",
    note: "Lunch and essentials",
    paymentMethod: "Card",
  });
  return { auth, database, request, setup, values, cookie, signup, config };
}

test("exact amount parsing respects zero, two, and three decimal currencies", () => {
  assert.equal(parseAmount("0.10", "GBP"), 10);
  assert.equal(parseAmount("0.20", "GBP"), 20);
  assert.equal(parseAmount("12", "JPY"), 12);
  assert.equal(parseAmount("1.234", "BHD"), 1234);
  assert.equal(amountInput(1234, "BHD"), "1.234");
  for (const bad of [
    "0",
    "-1",
    "1e3",
    "1,000",
    "NaN",
    "Infinity",
    "1.001",
    "1000000000000",
  ])
    assert.equal(parseAmount(bad, "GBP"), null, bad);
  assert.equal(parseAmount("1.1", "JPY"), null);
  assert.equal(parseAmount("1.2345", "BHD"), null);
});
test("dates validate leap years and today uses the selected timezone", () => {
  assert.equal(validDate("2024-02-29"), true);
  for (const bad of [
    "2025-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-1-01",
    "0000-01-01",
    "1899-12-31",
  ])
    assert.equal(validDate(bad), false);
  const instant = new Date("2026-10-28T00:30:00Z");
  assert.equal(todayIn("Pacific/Honolulu", instant), "2026-10-27");
  assert.equal(todayIn("Asia/Tokyo", instant), "2026-10-28");
});
test("workspace setup seeds private categories and rejects invalid settings", async (t) => {
  const f = await fixture(t);
  const initial = (await (await f.request("/workspace")).json()) as Workspace;
  assert.equal(initial.preferences.currency, null);
  assert.equal(initial.categories.length, 11);
  assert.equal(
    (await f.request("/expenses", "POST", f.values(initial.categories[0].id)))
      .status,
    409,
  );
  assert.equal(
    (await f.request("/workspace", "PUT", { currency: "XXX", timezone: "UTC" }))
      .status,
    400,
  );
  assert.equal(
    (
      await f.request("/workspace", "PUT", {
        currency: "GBP",
        timezone: "Somewhere/Invalid",
      })
    ).status,
    400,
  );
  const configured = await f.setup();
  assert.equal(configured.preferences.timezone, "Europe/London");
  assert.deepEqual(
    (await (await f.request("/workspace")).json()).categories,
    configured.categories,
  );
});
test("expenses persist, sum exactly, support edits and confirmed versioned deletion", async (t) => {
  const f = await fixture(t),
    workspace = await f.setup();
  const category = workspace.categories[0].id;
  const a = await f.request("/expenses", "POST", f.values(category, "0.10"));
  assert.equal(a.status, 201, await a.clone().text());
  const expense = (await a.json()) as Expense;
  assert.equal(expense.amountMinor, 10);
  assert.equal(expense.currency, "GBP");
  await f.request("/expenses", "POST", f.values(category, "0.20"));
  const list = (await (await f.request("/expenses")).json()) as ExpenseList;
  assert.equal(list.total, 2);
  assert.equal(list.totalMinor, 30);
  const second = await createAuthentication(f.config);
  try {
    const user = await second.auth.api.getSession({
      headers: new Headers({ cookie: f.cookie }),
    });
    const stored = createLedger(second.database).list(
      user!.user.id,
      {},
    ) as ExpenseList;
    assert.equal(stored.totalMinor, 30);
  } finally {
    second.database.close();
  }
  const changed = await f.request(`/expenses/${expense.id}`, "PATCH", {
    ...f.values(category, "1.00"),
    version: 1,
  });
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).version, 2);
  assert.equal(
    (
      await f.request(`/expenses/${expense.id}`, "PATCH", {
        ...f.values(category),
        version: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (await f.request(`/expenses/${expense.id}`, "DELETE", { version: 1 }))
      .status,
    409,
  );
  assert.equal(
    (await f.request(`/expenses/${expense.id}`, "DELETE", { version: 2 }))
      .status,
    204,
  );
  assert.equal((await f.request(`/expenses/${expense.id}`)).status, 404);
  assert.equal((await (await f.request("/expenses")).json()).totalMinor, 20);
  assert.equal(
    (await f.request("/workspace", "PUT", { currency: "USD", timezone: "UTC" }))
      .status,
    409,
  );
});
test("same-key concurrent retries do not duplicate expenses and a key cannot be reused after deletion", async (t) => {
  const f = await fixture(t),
    workspace = await f.setup();
  const body = f.values(workspace.categories[0].id),
    key = randomUUID();
  const responses = await Promise.all([
    f.request("/expenses", "POST", body, { key }),
    f.request("/expenses", "POST", body, { key }),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 201],
  );
  const a = (await responses[0].json()) as Expense,
    b = (await responses[1].json()) as Expense;
  assert.equal(a.id, b.id);
  assert.equal(
    (
      await f.request(
        "/expenses",
        "POST",
        { ...body, amount: "13.00" },
        { key },
      )
    ).status,
    409,
  );
  assert.equal((await (await f.request("/expenses")).json()).total, 1);
  await f.request(`/expenses/${a.id}`, "DELETE", { version: 1 });
  assert.equal(
    (await f.request("/expenses", "POST", body, { key })).status,
    409,
  );
  assert.equal(
    (await f.request("/workspace", "PUT", { currency: "USD", timezone: "UTC" }))
      .status,
    409,
  );
});
test("private records and categories cannot be read, changed, deleted, or assigned by another account", async (t) => {
  const f = await fixture(t),
    one = await f.setup();
  const response = await f.request("/expenses", "POST", {
    ...f.values(one.categories[0].id),
    owner: "ignored-attacker-owner",
  });
  const expense = (await response.json()) as Expense;
  const other = await f.signup("other@example.com"),
    two = await f.setup("USD", other);
  assert.notEqual(one.categories[0].id, two.categories[0].id);
  assert.equal(
    (
      await f.request(`/expenses/${expense.id}`, "GET", undefined, {
        cookie: other,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.request(
        `/expenses/${expense.id}`,
        "PATCH",
        { ...f.values(two.categories[0].id), version: 1 },
        { cookie: other },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.request(
        `/expenses/${expense.id}`,
        "DELETE",
        { version: 1 },
        { cookie: other },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.request("/expenses", "POST", f.values(one.categories[0].id), {
        cookie: other,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await (
        await f.request("/expenses", "GET", undefined, { cookie: other })
      ).json()
    ).total,
    0,
  );
  assert.equal(
    (await f.request("/expenses", "GET", undefined, { cookie: "" })).status,
    401,
  );
  assert.equal(
    (
      await f.request("/expenses", "POST", f.values(one.categories[0].id), {
        cookie: "",
      })
    ).status,
    401,
  );
});
test("expense mutations reject cross-origin requests and malformed or oversized input", async (t) => {
  const f = await fixture(t),
    workspace = await f.setup();
  const body = f.values(workspace.categories[0].id);
  const expense = (await (
    await f.request("/expenses", "POST", body)
  ).json()) as Expense;
  for (const [path, method, payload] of [
    ["/workspace", "PUT", { currency: "USD", timezone: "UTC" }],
    ["/categories", "POST", { name: "Private" }],
    ["/expenses", "POST", body],
    [`/expenses/${expense.id}`, "PATCH", { ...body, version: 1 }],
    [`/expenses/${expense.id}`, "DELETE", { version: 1 }],
  ] as const)
    assert.equal(
      (
        await f.request(path, method, payload, {
          origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
  assert.equal((await f.request("/expenses", "POST", [])).status, 400);
  assert.equal(
    (
      await f.request("/expenses", "POST", {
        ...body,
        note: "a".repeat(20_000),
      })
    ).status,
    413,
  );
  for (const bad of [
    { amount: "-1" },
    { amount: "1.001" },
    { amount: 12.34 },
    { date: "2026-02-30" },
    { date: "2099-01-01" },
    { categoryId: "missing" },
    { paymentMethod: "invalid" },
    { merchant: "m".repeat(121) },
    { note: "n".repeat(1001) },
  ])
    assert.equal(
      (await f.request("/expenses", "POST", { ...body, ...bad })).status,
      400,
    );
});
test("custom category creation is private and retries reuse the same name", async (t) => {
  const f = await fixture(t);
  await f.setup();
  const one = await (
    await f.request("/categories", "POST", { name: "  Pet supplies  " })
  ).json();
  const two = await (
    await f.request("/categories", "POST", { name: "pet supplies" })
  ).json();
  assert.equal(one.id, two.id);
  assert.equal(one.name, "Pet supplies");
  assert.equal(
    (await f.request("/categories", "POST", { name: " " })).status,
    400,
  );
});
test("pagination clamps deleted pages; filters, literal search, sorting and filtered totals agree", async (t) => {
  const f = await fixture(t),
    workspace = await f.setup();
  const a = workspace.categories[0].id,
    b = workspace.categories[1].id;
  for (let i = 0; i < 27; i++) {
    const response = await f.request("/expenses", "POST", {
      ...f.values(i === 0 ? b : a, String(i + 1)),
      merchant: i === 0 ? "100% grocery_store" : `Shop ${i}`,
      date: i === 0 ? "2026-10-01" : "2026-10-28",
    });
    assert.equal(response.status, 201);
  }
  const list = (await (
    await f.request("/expenses?sort=amount_desc&page=2")
  ).json()) as ExpenseList;
  assert.equal(list.items.length, 2);
  assert.equal(list.total, 27);
  assert.equal(list.totalMinor, 37800);
  assert.equal(list.items[0].amountMinor, 200);
  const literal = (await (
    await f.request("/expenses/search", "POST", { q: "%" })
  ).json()) as ExpenseList;
  assert.equal(literal.total, 1);
  assert.equal(
    (
      await (
        await f.request("/expenses/search", "POST", { q: "' OR 1=1 --" })
      ).json()
    ).total,
    0,
  );
  const filtered = (await (
    await f.request("/expenses/search", "POST", {
      from: "2026-10-01",
      to: "2026-10-02",
      category: b,
    })
  ).json()) as ExpenseList;
  assert.equal(filtered.total, 1);
  assert.equal(filtered.totalMinor, 100);
  const clamped = (await (
    await f.request("/expenses?page=999")
  ).json()) as ExpenseList;
  assert.equal(clamped.page, 2);
  assert.equal(
    (await f.request("/expenses?sort=amountMinor;DROP")).status,
    400,
  );
  assert.equal(
    (await f.request("/expenses?from=2026-11-01&to=2026-10-01")).status,
    400,
  );
});
