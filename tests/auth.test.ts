import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import { createAuthentication } from "../server/auth.js";
import { createApp } from "../server/app.js";
import { validateAuth } from "../src/lib/validation.js";

const origin = "http://localhost:3000";
const credentials = {
  name: "Alex Morgan",
  email: "alex@example.com",
  password: "a memorable test password",
};

async function fixture(t: TestContext, production = false) {
  const directory = mkdtempSync(join(tmpdir(), "expense-auth-"));
  const config = {
    databasePath: join(directory, "test.sqlite"),
    secret: randomBytes(32).toString("base64url"),
    baseURL: production ? "https://localhost:3000" : origin,
    production,
  };
  const { auth, database } = await createAuthentication(config);
  const server = createApp(auth, database, production).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const post = (
    path: string,
    body: unknown,
    cookie = "",
    requestOrigin = config.baseURL,
  ) =>
    fetch(`${base}/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: requestOrigin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  return { auth, database, base, post, config };
}
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

test("protected API and app reject visitors without a session", async (t) => {
  const { base } = await fixture(t);
  assert.equal((await fetch(`${base}/api/me`)).status, 401);
  const app = await fetch(`${base}/app`, { redirect: "manual" });
  assert.equal(app.status, 303);
  assert.equal(app.headers.get("location"), "/sign-in");
  assert.equal(app.headers.get("cache-control"), "no-store");
});

test("production responses use secure cookies and restrictive security headers", async (t) => {
  const { post, base } = await fixture(t, true);
  const registered = await post("/sign-up/email", credentials);
  assert.equal(registered.status, 200, await registered.clone().text());
  assert.match(registered.headers.get("set-cookie") || "", /; secure/i);
  assert.match(registered.headers.get("set-cookie") || "", /httponly/i);
  const response = await fetch(`${base}/api/me`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-security-policy") || "",
    /script-src 'self'/,
  );
  assert.ok(response.headers.get("strict-transport-security"));
});

test("separate accounts only receive their own profile and tampered cookies fail", async (t) => {
  const { post, base } = await fixture(t);
  const alex = await post("/sign-up/email", credentials);
  const sam = await post("/sign-up/email", {
    ...credentials,
    name: "Sam",
    email: "sam@example.com",
  });
  assert.equal(alex.status, 200);
  assert.equal(sam.status, 200);
  const alexProfile = await fetch(`${base}/api/me?userId=another-user`, {
    headers: { Cookie: cookies(alex) },
  });
  const samProfile = await fetch(`${base}/api/me`, {
    headers: { Cookie: cookies(sam) },
  });
  const a = await alexProfile.json();
  const b = await samProfile.json();
  assert.equal(a.user.email, credentials.email);
  assert.equal(b.user.email, "sam@example.com");
  assert.notEqual(a.user.id, b.user.id);
  assert.equal(
    (
      await fetch(`${base}/api/me`, {
        headers: { Cookie: `${cookies(alex)}corrupt` },
      })
    ).status,
    401,
  );
});

test("signup creates a hashed password, usable cookie, private profile, and persistent account", async (t) => {
  const { post, database, base, config } = await fixture(t);
  const response = await post("/sign-up/email", {
    ...credentials,
    name: "  Alex Morgan  ",
    email: "ALEX@example.com",
  });
  assert.equal(response.status, 200, await response.clone().text());
  const cookie = cookies(response);
  assert.ok(cookie);
  assert.match(response.headers.get("set-cookie") || "", /httponly/i);
  assert.match(response.headers.get("set-cookie") || "", /samesite=lax/i);
  const account = database.prepare("SELECT password FROM account").get() as {
    password: string;
  };
  assert.ok(account.password.length > 64);
  assert.notEqual(account.password, credentials.password);
  const profile = await fetch(`${base}/api/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(profile.status, 200);
  const data = await profile.json();
  assert.equal(data.user.email, "alex@example.com");
  assert.equal(data.user.name, "Alex Morgan");
  assert.deepEqual(Object.keys(data.user).sort(), ["email", "id", "name"]);
  const second = await createAuthentication(config);
  try {
    const persisted = await second.auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    assert.equal(persisted?.user.email, credentials.email);
  } finally {
    second.database.close();
  }
});

test("sign-in, sign-out, and replay of a revoked cookie", async (t) => {
  const { post, base } = await fixture(t);
  assert.equal((await post("/sign-up/email", credentials)).status, 200);
  const login = await post("/sign-in/email", {
    email: credentials.email,
    password: credentials.password,
  });
  assert.equal(login.status, 200);
  const cookie = cookies(login);
  assert.equal(
    (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).status,
    200,
  );
  assert.equal((await post("/sign-out", {}, cookie)).status, 200);
  assert.equal(
    (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).status,
    401,
  );
});

test("wrong passwords and unknown accounts return the same generic failure", async (t) => {
  const { post } = await fixture(t);
  await post("/sign-up/email", credentials);
  const wrong = await post("/sign-in/email", {
    email: credentials.email,
    password: "a wrong test password",
  });
  const unknown = await post("/sign-in/email", {
    email: "unknown@example.com",
    password: "a wrong test password",
  });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal((await wrong.json()).code, (await unknown.json()).code);
});

test("server rejects weak passwords, invalid names, and duplicate emails", async (t) => {
  const { post, database } = await fixture(t);
  assert.ok(
    (await post("/sign-up/email", { ...credentials, password: "short" }))
      .status >= 400,
  );
  assert.equal(
    (await post("/sign-up/email", { ...credentials, name: " ".repeat(4) }))
      .status,
    400,
  );
  assert.equal((await post("/sign-up/email", credentials)).status, 200);
  await post("/sign-up/email", { ...credentials, email: "ALEX@example.com" });
  const count = database
    .prepare("SELECT COUNT(*) AS count FROM user")
    .get() as { count: number };
  assert.equal(count.count, 1);
});

test("cross-site signup and sign-out are rejected without changing the session", async (t) => {
  const { post, base } = await fixture(t);
  assert.equal(
    (await post("/sign-up/email", credentials, "", "https://untrusted.example"))
      .status,
    403,
  );
  const registered = await post("/sign-up/email", credentials);
  assert.equal(registered.status, 200);
  const cookie = cookies(registered);
  assert.equal(
    (await post("/sign-out", {}, cookie, "https://untrusted.example")).status,
    403,
  );
  assert.equal(
    (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).status,
    200,
  );
});

test("rate limiting cannot be bypassed by a forged client IP header", async (t) => {
  const { base } = await fixture(t);
  const statuses: number[] = [];
  for (let i = 0; i < 10; i++) {
    const response = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "x-expense-client-ip": `198.51.100.${i}`,
        "x-forwarded-for": `198.51.100.${i}`,
      },
      body: JSON.stringify({
        email: "missing@example.com",
        password: "a wrong test password",
      }),
    });
    statuses.push(response.status);
  }
  assert.ok(
    statuses.includes(429),
    `Expected throttling; received ${statuses}`,
  );
});

test("expired sessions cannot load a private profile", async (t) => {
  const { post, base, database } = await fixture(t);
  const registered = await post("/sign-up/email", credentials);
  const cookie = cookies(registered);
  const record = database.prepare("SELECT expiresAt FROM session").get() as {
    expiresAt: number | string;
  };
  const expired =
    typeof record.expiresAt === "number"
      ? Date.now() - 86_400_000
      : new Date(Date.now() - 86_400_000).toISOString();
  database.prepare("UPDATE session SET expiresAt = ?").run(expired);
  assert.equal(
    (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).status,
    401,
  );
});

test("signup validation checks confirmation; sign-in accepts existing passwords independently of signup minimum", () => {
  assert.equal(
    validateAuth({ ...credentials, confirm: "different" }, true).confirm,
    "Your passwords do not match.",
  );
  assert.deepEqual(
    validateAuth({ ...credentials, password: "old", confirm: "" }, false),
    {},
  );
});

test("the home URL returns signed-in users to their workspace without caching", async (t) => {
  const f = await fixture(t);
  const guest = await fetch(`${f.base}/`, { redirect: "manual" });
  assert.equal(guest.headers.get("location"), "/sign-in");
  const signup = await f.post("/sign-up/email", credentials);
  const member = await fetch(`${f.base}/`, {
    redirect: "manual",
    headers: { Cookie: cookies(signup) },
  });
  assert.equal(member.headers.get("location"), "/app");
  assert.match(member.headers.get("cache-control") || "", /no-store/);
});
