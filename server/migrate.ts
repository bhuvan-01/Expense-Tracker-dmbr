import { loadConfig } from "./config.js";
import { createAuthentication } from "./auth.js";

const { database } = await createAuthentication(loadConfig());
database.close();
console.log("Authentication database migrations complete.");
