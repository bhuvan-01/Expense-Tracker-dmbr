import express from "express";
import helmet from "helmet";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { resolve } from "node:path";
import type { createAuthentication } from "./auth.js";
import type Database from "better-sqlite3";
import { ledgerRoutes } from "./ledger-routes.js";

type Authentication = Awaited<ReturnType<typeof createAuthentication>>;

export function createApp(
  auth: Authentication["auth"],
  database: Database.Database,
  production = false,
) {
  const app = express();
  app.disable("x-powered-by");
  // Explicit proxy networks only; never blindly trust client-supplied forwarding headers.
  if (process.env.TRUSTED_PROXY_CIDRS)
    app.set(
      "trust proxy",
      process.env.TRUSTED_PROXY_CIDRS.split(",").map((value) => value.trim()),
    );
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              scriptSrc: ["'self'"],
              styleSrc: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use((req, res, next) => {
    // Always overwrite this header so a visitor cannot evade throttling by spoofing it.
    req.headers["x-expense-client-ip"] =
      req.ip || req.socket.remoteAddress || "unknown";
    if (
      req.path === "/" ||
      req.path.startsWith("/api/") ||
      req.path.startsWith("/app") ||
      req.path.startsWith("/sign-")
    )
      res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.all("/api/auth/{*path}", toNodeHandler(auth));
  app.get("/api/me", async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session)
      return res.status(401).json({ error: "Sign in to continue." });
    return res.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });
  });
  app.use("/api", ledgerRoutes(auth, database));
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));
  app.use(["/app", "/app/{*path}"], async (req, res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) return res.redirect(303, "/sign-in");
    next();
  });
  app.get("/", async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    return res.redirect(303, session ? "/app" : "/sign-in");
  });
  if (production) {
    app.use(express.static(resolve("dist"), { index: false }));
    app.get(["/sign-in", "/sign-up", "/app"], (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
    app.use((_req, res) => res.status(404).send("Page not found."));
  }
  return app;
}
