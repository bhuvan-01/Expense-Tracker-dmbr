import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { PASSWORD_MIN, PASSWORD_MAX } from "../src/lib/validation.js";

export type AuthConfig = {
  databasePath: string;
  secret: string;
  baseURL: string;
  production?: boolean;
};

export async function createAuthentication(config: AuthConfig) {
  const database = new Database(config.databasePath);
  database.exec(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
  );
  const auth = betterAuth({
    appName: "Expense Tracker",
    database,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      // Email verification/recovery needs a mail provider and is a separate milestone.
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: config.production ?? false,
      ipAddress: { ipAddressHeaders: ["x-expense-client-ip"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const name =
          typeof ctx.body?.name === "string" ? ctx.body.name.trim() : "";
        if (!name || name.length > 80) {
          throw new APIError("BAD_REQUEST", {
            message: "Enter your name using 1–80 characters.",
          });
        }
        return { context: { body: { ...ctx.body, name } } };
      }),
    },
    logger: { level: "error" },
  });
  // Additive, library-owned migrations. Never resets existing accounts.
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  return { auth, database };
}
