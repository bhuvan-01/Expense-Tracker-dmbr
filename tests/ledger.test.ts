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
    currency: "GBP",
    amount,
    date: "2026-10-28",
    categoryId,
    merchant: "Weekly groceries",
    note: "Lunch and essentials",
    paymentMethod: "Card",
  });
  return { auth, database, request, setup, values, cookie, signup, config };
}

test("a currency change in another tab cannot reinterpret a pending expense", async (t) => {
  const f = await fixture(t),
    original = await f.setup();
  const body = f.values(original.categories[0].id);
  await f.setup("USD");
  assert.equal((await f.request("/expenses", "POST", body)).status, 409);
  assert.equal((await (await f.request("/expenses")).json()).total, 0);
  const response = await f.request("/expenses", "POST", {
    ...body,
    currency: "USD",
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).currency, "USD");
});

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
      await f.request(
        "/expenses",
        "POST",
        { ...f.values(one.categories[0].id), currency: "USD" },
        {
          cookie: other,
        },
      )
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

test("income, linked partial refunds and archived categories retain private consistent history", async (t) => {
  const f = await fixture(t),
    workspace = await f.setup();
  const category = workspace.categories[0];
  const body = f.values(category.id, "25.00");
  const original = (await (
    await f.request("/expenses", "POST", body)
  ).json()) as Expense;
  const incomeBody = {
    ...body,
    amount: "1000.00",
    merchant: "Salary",
    categoryId: undefined,
  };
  const key = randomUUID();
  let response = await f.request("/income", "POST", incomeBody, { key });
  assert.equal(response.status, 201, await response.clone().text());
  let income = (await response.json()) as Expense;
  assert.equal(
    (await f.request("/income", "POST", incomeBody, { key })).status,
    200,
  );
  assert.equal(
    (
      await f.request(
        "/income",
        "POST",
        { ...incomeBody, amount: "999" },
        { key },
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(`/income/${income.id}`, "PATCH", {
        ...incomeBody,
        version: 1,
        amount: "1100",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(`/income/${income.id}`, "PATCH", {
        ...incomeBody,
        version: 1,
      })
    ).status,
    409,
  );
  const otherCookie = await f.signup("cash-other@example.com");
  await f.setup("GBP", otherCookie);
  assert.equal(
    (
      await f.request(`/income/${income.id}`, "GET", undefined, {
        cookie: otherCookie,
      })
    ).status,
    404,
  );
  const refundBody = { ...body, expenseId: original.id, amount: "10.00" };
  response = await f.request("/refunds", "POST", refundBody);
  assert.equal(response.status, 201, await response.clone().text());
  const refund = (await response.json()) as Expense;
  assert.equal(
    (await f.request("/refunds", "POST", { ...refundBody, amount: "15.01" }))
      .status,
    400,
  );
  assert.equal(
    (await f.request("/refunds", "POST", { ...refundBody, date: "2026-10-27" }))
      .status,
    400,
  );
  assert.equal(
    (await f.request("/refunds", "POST", refundBody, { cookie: otherCookie }))
      .status,
    404,
  );
  assert.equal(
    (await f.request(`/expenses/${original.id}`, "DELETE", { version: 1 }))
      .status,
    409,
  );
  assert.equal(
    (
      await f.request(`/expenses/${original.id}`, "PATCH", {
        ...body,
        amount: "9",
        version: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(`/expenses/${original.id}`, "PATCH", {
        ...body,
        date: "2026-10-29",
        version: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (await (await f.request(`/expenses/${original.id}`)).json())
      .refundableMinor,
    1500,
  );
  response = await f.request(`/categories/${category.id}`, "PATCH", {
    name: "Renamed category",
    version: category.version,
    archived: true,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const changed = await response.json();
  assert.equal(
    (
      await f.request(`/categories/${category.id}`, "PATCH", {
        name: "Stale",
        version: category.version,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        `/categories/${category.id}`,
        "PATCH",
        { name: "Stolen", version: changed.version },
        { cookie: otherCookie },
      )
    ).status,
    404,
  );
  assert.equal((await f.request("/expenses", "POST", body)).status, 400);
  assert.equal(
    (
      await f.request(`/expenses/${original.id}`, "PATCH", {
        ...body,
        amount: "30",
        version: 1,
      })
    ).status,
    200,
  );
  const refreshed = (await (await f.request("/workspace")).json()) as Workspace;
  assert.equal(refreshed.categories.length, workspace.categories.length);
  assert.equal(
    refreshed.categories.find((item) => item.id === category.id)?.name,
    "Renamed category",
  );
  const refunds = await (
    await f.request("/refunds/search", "POST", { q: "Renamed category" })
  ).json();
  assert.equal(refunds.totalMinor, 1000);
  assert.equal(refunds.total, 1);
  assert.equal(
    (
      await f.request(`/refunds/${refund.id}`, "DELETE", {
        version: refund.version,
      })
    ).status,
    204,
  );
  assert.equal(
    (await f.request(`/expenses/${original.id}`, "DELETE", { version: 2 }))
      .status,
    204,
  );
  income = (await (await f.request(`/income/${income.id}`)).json()) as Expense;
  assert.equal(
    (
      await f.request(`/income/${income.id}`, "DELETE", {
        version: income.version,
      })
    ).status,
    204,
  );
  assert.equal(
    (await f.request("/income", "POST", incomeBody, { key })).status,
    409,
  );
  assert.equal((await f.setup()).preferences.currencyLocked, 1);
});

test("monthly summaries share exact dated events, include old-purchase refunds and isolate owners", async (t) => {
  const f = await fixture(t),
    w = await f.setup();
  const body = f.values(w.categories[0].id, "25.00");
  const original = (await (
    await f.request("/expenses", "POST", body)
  ).json()) as Expense;
  const refund = (await (
    await f.request("/refunds", "POST", {
      ...body,
      expenseId: original.id,
      amount: "5",
      date: "2026-11-01",
    })
  ).json()) as Expense;
  assert.equal(
    (
      await f.request("/income", "POST", {
        ...body,
        amount: "100",
        date: "2026-11-02",
      })
    ).status,
    201,
  );
  const report = await (await f.request("/summary?month=2026-11")).json();
  assert.deepEqual(report.totals, {
    expensesMinor: 0,
    refundsMinor: 500,
    incomeMinor: 10000,
    netMinor: -500,
    differenceMinor: 10500,
    count: 2,
  });
  assert.equal(report.previous.netMinor, 2500);
  assert.equal(report.categories[0].netMinor, -500);
  assert.equal(
    report.days.reduce(
      (sum: number, day: { differenceMinor: number }) =>
        sum + day.differenceMinor,
      0,
    ),
    report.totals.differenceMinor,
  );
  assert.equal(
    (
      await f.request(`/refunds/${refund.id}`, "PATCH", {
        ...body,
        expenseId: original.id,
        amount: "6",
        date: "2026-11-01",
        version: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (await (await f.request("/summary?month=2026-11")).json()).totals
      .refundsMinor,
    600,
  );
  const other = await f.signup("summary-other@example.com");
  await f.setup("GBP", other);
  assert.equal(
    (
      await (
        await f.request("/summary?month=2026-11", "GET", undefined, {
          cookie: other,
        })
      ).json()
    ).totals.count,
    0,
  );
  assert.equal((await f.request("/summary?month=1900-01")).status, 200);
  assert.equal(
    (await (await f.request("/summary?month=2000-02")).json()).to,
    "2000-02-29",
  );
  assert.equal(
    (await (await f.request("/summary?month=2100-02")).json()).to,
    "2100-02-28",
  );
  for (const month of ["2026-13", "2026-1", "bad", "2200-01"])
    assert.equal((await f.request(`/summary?month=${month}`)).status, 400);
});

test("monthly budgets support zero, safe retries, versioned removal and private independent category limits", async (t) => {
  const f = await fixture(t),
    w = await f.setup();
  const body = {
    month: "2026-10",
    scope: "",
    currency: "GBP",
    amount: "10",
    version: 0,
  };
  let response = await f.request("/budgets", "PUT", body);
  assert.equal(response.status, 200, await response.clone().text());
  let data = await response.json();
  assert.equal(data.items[0].limitMinor, 1000);
  assert.equal(data.items[0].version, 1);
  assert.equal((await f.request("/budgets", "PUT", body)).status, 200);
  assert.equal(
    (await f.request("/budgets", "PUT", { ...body, amount: "11" })).status,
    409,
  );
  assert.equal((await f.setup()).preferences.currencyLocked, 1);
  assert.equal(
    (await f.request("/workspace", "PUT", { currency: "USD", timezone: "UTC" }))
      .status,
    409,
  );
  assert.equal(
    (await f.request("/budgets", "PUT", { ...body, amount: "0", version: 1 }))
      .status,
    200,
  );
  const original = (await (
    await f.request("/expenses", "POST", f.values(w.categories[0].id, "5"))
  ).json()) as Expense;
  data = await (await f.request("/budgets?month=2026-10")).json();
  assert.equal(data.items[0].spentMinor, 500);
  assert.equal(data.summary.totals.netMinor, 500);
  assert.equal(data.items[0].limitMinor, 0);
  response = await f.request("/budgets", "PUT", {
    ...body,
    scope: w.categories[0].id,
    amount: "20",
  });
  data = await response.json();
  assert.equal(data.items[0].limitMinor, 0);
  assert.equal(
    data.items.find(
      (item: { scope: string }) => item.scope === w.categories[0].id,
    ).limitMinor,
    2000,
  );
  await f.request("/refunds", "POST", {
    ...f.values(w.categories[0].id, "2"),
    expenseId: original.id,
  });
  data = await (await f.request("/budgets?month=2026-10")).json();
  assert.equal(data.items[0].spentMinor, 300);
  response = await f.request("/budgets", "PUT", {
    ...body,
    amount: null,
    version: 2,
  });
  data = await response.json();
  assert.equal(data.items[0].limitMinor, null);
  assert.equal(data.items[0].version, 3);
  assert.equal((await f.request("/budgets", "PUT", body)).status, 409);
  assert.equal(
    (await (await f.request("/budgets?month=2026-11")).json()).items[0]
      .limitMinor,
    null,
  );
  for (const amount of ["-1", "0.000", "1.001", "NaN", "10000000000"])
    assert.equal(
      (await f.request("/budgets", "PUT", { ...body, amount, version: 3 }))
        .status,
      400,
    );
  assert.equal(
    (
      await f.request("/budgets", "PUT", {
        ...body,
        currency: "USD",
        version: 3,
      })
    ).status,
    409,
  );
  const other = await f.signup("budget-other@example.com");
  await f.setup("GBP", other);
  assert.equal(
    (
      await f.request(
        "/budgets",
        "PUT",
        { ...body, scope: w.categories[0].id },
        { cookie: other },
      )
    ).status,
    404,
  );
  data = await (
    await f.request("/budgets?month=2026-10", "GET", undefined, {
      cookie: other,
    })
  ).json();
  assert.equal(data.items[0].limitMinor, null);
  assert.equal(data.items[0].spentMinor, 0);
});

test("CSV exports are private, cover every filtered page and neutralize spreadsheet formulas", async (t) => {
  const f = await fixture(t),
    w = await f.setup();
  const body = {
    ...f.values(w.categories[0].id, "25"),
    merchant: "=SUM(1,2)",
    note: ' \t@formula\nA "quoted", note',
  };
  const original = (await (
    await f.request("/expenses", "POST", body)
  ).json()) as Expense;
  await f.request("/refunds", "POST", {
    ...body,
    amount: "5",
    expenseId: original.id,
    date: "2026-11-01",
  });
  await f.request("/income", "POST", {
    ...body,
    amount: "100",
    date: "2026-11-01",
  });
  let response = await f.request("/export", "POST", {
    kind: "all",
    filters: { from: "2026-11-01", to: "2026-11-30" },
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get("content-type") || "", /text\/csv/);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  let csv = await response.text();
  assert.ok(csv.includes('"refund"'));
  assert.ok(csv.includes('"income"'));
  assert.ok(!csv.includes('"expense"'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"\'@formula\nA ""quoted"", note"'));
  assert.ok(csv.includes("-5.00,0.00"));
  assert.ok(csv.includes("0.00,100.00"));
  assert.ok(csv.includes(original.id));
  const other = await f.signup("csv-other@example.com");
  await f.setup("GBP", other);
  csv = await (
    await f.request("/export", "POST", { kind: "all" }, { cookie: other })
  ).text();
  assert.ok(!csv.includes(original.id));
  for (let index = 0; index < 26; index++)
    assert.equal(
      (
        await f.request("/expenses", "POST", {
          ...body,
          merchant: "Export pagination",
          amount: "0.01",
        })
      ).status,
      201,
    );
  response = await f.request("/export", "POST", {
    kind: "expense",
    filters: { q: "Export pagination", page: 2 },
  });
  csv = await response.text();
  assert.equal((csv.match(/"Export pagination"/g) || []).length, 26);
  assert.equal(
    (await f.request("/export", "POST", { kind: ["expense"] })).status,
    400,
  );
  assert.equal(
    (await f.request("/export", "POST", { kind: "all", filters: [] })).status,
    400,
  );
  assert.equal(
    (await f.request("/export", "POST", { kind: "all" }, { cookie: "" }))
      .status,
    401,
  );
  assert.equal(
    (
      await f.request(
        "/export",
        "POST",
        { kind: "all" },
        { origin: "https://elsewhere.example" },
      )
    ).status,
    403,
  );
});
