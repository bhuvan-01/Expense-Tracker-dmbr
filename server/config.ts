import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export function loadConfig() {
  const production =
    process.argv.includes("--production") ||
    process.env.NODE_ENV === "production";
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be a valid port number.");
  const baseURL = process.env.BETTER_AUTH_URL || `http://localhost:${port}`;
  const url = new URL(baseURL);
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      "BETTER_AUTH_URL must be an origin without a path or credentials.",
    );
  if (production && url.protocol !== "https:")
    throw new Error("Production requires an HTTPS BETTER_AUTH_URL.");
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("BETTER_AUTH_URL must use HTTP or HTTPS.");
  const databasePath = resolve(
    process.env.DATABASE_PATH || ".data/expense-tracker.sqlite",
  );
  mkdirSync(dirname(databasePath), { recursive: true });
  let secret = process.env.BETTER_AUTH_SECRET;
  if (!secret && !production) {
    const secretPath = resolve(".data/development-secret");
    mkdirSync(dirname(secretPath), { recursive: true });
    if (!existsSync(secretPath))
      writeFileSync(secretPath, randomBytes(32).toString("base64url"), {
        mode: 0o600,
        flag: "wx",
      });
    secret = readFileSync(secretPath, "utf8").trim();
  }
  if (!secret || secret.length < 32)
    throw new Error("Set BETTER_AUTH_SECRET to at least 32 random characters.");
  return { production, port, baseURL: url.origin, databasePath, secret };
}
