import Database from "better-sqlite3";
import { mkdirSync, openSync, closeSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
export async function backupDatabase(
  sourcePath: string,
  destinationPath: string,
) {
  const source = resolve(sourcePath),
    destination = resolve(destinationPath);
  if (source === destination)
    throw new Error("Choose a backup path different from the active database.");
  const database = new Database(source, {
    readonly: true,
    fileMustExist: true,
  });
  let reserved = false;
  try {
    if (database.pragma("quick_check", { simple: true }) !== "ok")
      throw new Error(
        "Database integrity check failed. Preserve the database and investigate before backing up.",
      );
    mkdirSync(dirname(destination), { recursive: true });
    closeSync(openSync(destination, "wx", 0o600));
    reserved = true;
    await database.backup(destination);
    const copy = new Database(destination, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      if (copy.pragma("quick_check", { simple: true }) !== "ok")
        throw new Error("Backup integrity check failed.");
    } finally {
      copy.close();
    }
    return destination;
  } catch (error) {
    if (reserved) rmSync(destination, { force: true });
    throw error;
  } finally {
    database.close();
  }
}
