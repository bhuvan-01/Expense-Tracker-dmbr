import type Database from "better-sqlite3";
import { LedgerError } from "./ledger.js";
import { monthRange, summaries } from "./summary.js";
import {
  CURRENCIES,
  parseAmount,
  type Preferences,
} from "../src/lib/ledger.js";
import type { Budget, BudgetMonth } from "../src/lib/budgets.js";
export function initializeBudgets(db: Database.Database) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS monthly_budgets (owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, month TEXT NOT NULL, scope TEXT NOT NULL, limitMinor INTEGER CHECK(limitMinor >= 0 AND limitMinor <= 999999999), version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(owner, month, scope));`,
  );
}
export function budgets(db: Database.Database) {
  const read = db.transaction((owner: string, value: unknown): BudgetMonth => {
    const summary = summaries(db).month(owner, value);
    const saved = db
      .prepare(
        "SELECT scope, limitMinor, version FROM monthly_budgets WHERE owner = ? AND month = ?",
      )
      .all(owner, summary.month) as {
      scope: string;
      limitMinor: number | null;
      version: number;
    }[];
    const categories = db
      .prepare(
        "SELECT id, name, archived FROM expense_categories WHERE owner = ? ORDER BY archived, name COLLATE NOCASE",
      )
      .all(owner) as { id: string; name: string; archived: number }[];
    const items = [
      { id: "", name: "Overall budget", archived: 0 },
      ...categories,
    ].map((category): Budget => {
      const current = saved.find((item) => item.scope === category.id);
      return {
        scope: category.id,
        name: category.name,
        archived: category.archived,
        limitMinor: current?.limitMinor ?? null,
        version: current?.version || 0,
        spentMinor: category.id
          ? summary.categories.find((item) => item.id === category.id)
              ?.netMinor || 0
          : summary.totals.netMinor,
      };
    });
    return { month: summary.month, summary, items };
  });
  const save = db.transaction(
    (owner: string, body: Record<string, unknown>) => {
      const month = monthRange(body.month).month;
      const prefs = db
        .prepare(
          "SELECT currency, timezone FROM workspace_preferences WHERE owner = ?",
        )
        .get(owner) as Preferences | undefined;
      if (!prefs?.currency || body.currency !== prefs.currency)
        throw new LedgerError(
          409,
          "Reload your workspace to confirm its currency before saving a budget.",
        );
      const scope = typeof body.scope === "string" ? body.scope : null;
      if (
        scope === null ||
        (scope &&
          !db
            .prepare(
              "SELECT 1 FROM expense_categories WHERE owner = ? AND id = ?",
            )
            .get(owner, scope))
      )
        throw new LedgerError(404, "Category not found.");
      if (!Number.isSafeInteger(body.version) || Number(body.version) < 0)
        throw new LedgerError(400, "A budget version is required.");
      let limitMinor: number | null = null;
      if (body.amount !== null) {
        limitMinor = parseAmount(body.amount, prefs.currency);
        const zero =
          typeof body.amount === "string" &&
          body.amount.length <= 24 &&
          /^0+(?:\.0+)?$/.test(body.amount.trim()) &&
          (body.amount.trim().split(".")[1]?.length || 0) <=
            CURRENCIES[prefs.currency].digits;
        if (zero) limitMinor = 0;
        if (limitMinor === null)
          throw new LedgerError(
            400,
            "Enter zero or a positive amount using your workspace currency precision.",
            { amount: "Enter a valid budget amount." },
          );
      }
      const current = db
        .prepare(
          "SELECT version, limitMinor FROM monthly_budgets WHERE owner = ? AND month = ? AND scope = ?",
        )
        .get(owner, month, scope) as
        { version: number; limitMinor: number | null } | undefined;
      if (
        current &&
        current.version === Number(body.version) + 1 &&
        current.limitMinor === limitMinor
      )
        return read(owner, month);
      if ((current?.version || 0) !== body.version)
        throw new LedgerError(
          409,
          "This budget changed elsewhere. Close the form and refresh before editing.",
        );
      db.prepare(
        "INSERT INTO monthly_budgets (owner, month, scope, limitMinor, version) VALUES (?, ?, ?, ?, 1) ON CONFLICT(owner, month, scope) DO UPDATE SET limitMinor = excluded.limitMinor, version = monthly_budgets.version + 1",
      ).run(owner, month, scope, limitMinor);
      if (limitMinor !== null)
        db.prepare(
          "UPDATE workspace_preferences SET currencyLocked = 1 WHERE owner = ?",
        ).run(owner);
      return read(owner, month);
    },
  );
  return { read, save };
}
