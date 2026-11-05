import { createServer } from "vite";
import { loadConfig } from "./config.js";
import { createAuthentication } from "./auth.js";
import { createApp } from "./app.js";

const config = loadConfig();
const { auth, database } = await createAuthentication(config);
const app = createApp(auth, database, config.production);
const vite = config.production
  ? undefined
  : await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.E2E_TEST === "1" ? false : undefined,
      },
      appType: "spa",
    });
if (vite) app.use(vite.middlewares);
app.use(((error, _req, res, _next) => {
  // Do not log request bodies, headers, credentials, or database details.
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  if (!res.headersSent)
    res.status(500).json({ error: "Something went wrong. Please try again." });
}) as import("express").ErrorRequestHandler);
const server = app.listen(config.port, process.env.HOST || "127.0.0.1", () => {
  console.log(`Expense Tracker running at ${config.baseURL}`);
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await vite?.close();
    database.close();
    process.exit(0);
  });
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
