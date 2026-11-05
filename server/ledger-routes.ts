import express from "express";
import type Database from "better-sqlite3";
import { fromNodeHeaders } from "better-auth/node";
import type { createAuthentication } from "./auth.js";
import { createLedger, LedgerError } from "./ledger.js";

type Auth = Awaited<ReturnType<typeof createAuthentication>>["auth"];
export function ledgerRoutes(auth: Auth, database: Database.Database) {
  const router = express.Router();
  const ledger = createLedger(database);
  router.use(async (req, res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session)
      return res.status(401).json({
        error: "Your session has expired. Sign in again to continue.",
        code: "SESSION_EXPIRED",
      });
    res.locals.owner = session.user.id;
    if (!["GET", "HEAD"].includes(req.method)) {
      if (
        req.headers.origin !== new URL(String(auth.options.baseURL)).origin ||
        !req.is("application/json")
      )
        return res.status(403).json({
          error: "This request must come from your signed-in workspace.",
        });
    }
    next();
  });
  router.use(express.json({ limit: "16kb" }));
  router.use((req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) &&
      (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    )
      return res.status(400).json({ error: "Send a valid JSON object." });
    next();
  });
  router.get("/workspace", (_req, res) =>
    res.json(ledger.workspace(res.locals.owner)),
  );
  router.put("/workspace", (req, res) =>
    res.json(ledger.setup(res.locals.owner, req.body)),
  );
  router.post("/categories", (req, res) =>
    res.status(201).json(ledger.addCategory(res.locals.owner, req.body)),
  );
  router.get("/expenses", (req, res) =>
    res.json(ledger.list(res.locals.owner, req.query)),
  );
  // Search text stays out of URLs, browser history, and access-log request paths.
  router.post("/expenses/search", (req, res) =>
    res.json(ledger.list(res.locals.owner, req.body)),
  );
  router.get("/expenses/:id", (req, res) =>
    res.json(ledger.get(res.locals.owner, String(req.params.id))),
  );
  router.post("/expenses", (req, res) => {
    const result = ledger.create(
      res.locals.owner,
      req.body,
      String(req.headers["idempotency-key"] || ""),
    );
    return res.status(result.replay ? 200 : 201).json(result.expense);
  });
  router.patch("/expenses/:id", (req, res) =>
    res.json(ledger.update(res.locals.owner, String(req.params.id), req.body)),
  );
  router.delete("/expenses/:id", (req, res) => {
    ledger.remove(res.locals.owner, String(req.params.id), req.body.version);
    return res.status(204).end();
  });
  router.use(((error, _req, res, _next) => {
    if (error instanceof LedgerError)
      return res
        .status(error.status)
        .json({ error: error.message, fields: error.fields });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: "Send valid JSON." });
    if (error?.type === "entity.too.large")
      return res.status(413).json({ error: "This request is too large." });
    console.error("Ledger request failed.");
    return res
      .status(500)
      .json({ error: "Unable to complete this request. Please try again." });
  }) as express.ErrorRequestHandler);
  return router;
}
