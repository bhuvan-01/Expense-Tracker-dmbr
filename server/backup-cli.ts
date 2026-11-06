import { resolve } from "node:path";
import { backupDatabase } from "./backup.js";
const source = process.env.DATABASE_PATH || ".data/expense-tracker.sqlite";
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const destination =
  process.argv[2] || `.data/backups/expense-tracker-${stamp}.sqlite`;
try {
  await backupDatabase(source, destination);
  console.log(`Backup verified: ${resolve(destination)}`);
  console.log(
    "Store the database backup and authentication secret privately. See PERSONAL_USE.md for recovery steps.",
  );
} catch {
  console.error(
    "Backup failed. Check that the source exists, the destination is new and writable, and the database passes its integrity check. Existing backups are never overwritten.",
  );
  process.exitCode = 1;
}
