import type Database from "better-sqlite3";
import { LedgerError } from "./ledger.js";
import type {
  CategoryTotal,
  MonthSummary,
  Totals,
} from "../src/lib/summary.js";
export function monthRange(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(value)
  )
    throw new LedgerError(400, "Choose a month from 1900 through 2199.");
  const [year, month] = value.split("-").map(Number);
  return {
    month: value,
    from: `${value}-01`,
    to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
    previous: new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7),
  };
}
function total(row: Record<string, number>): Totals {
  const expensesMinor = row.expensesMinor || 0,
    refundsMinor = row.refundsMinor || 0,
    incomeMinor = row.incomeMinor || 0;
  return {
    expensesMinor,
    refundsMinor,
    incomeMinor,
    netMinor: expensesMinor - refundsMinor,
    differenceMinor: incomeMinor - expensesMinor + refundsMinor,
    count: row.count || 0,
  };
}
export function summaries(db: Database.Database) {
  // Every surface uses the same dated events. Refunds affect their recorded period, including refunds of older purchases.
  const events = `WITH events AS (
    SELECT id, owner, date, categoryId, amountMinor AS expensesMinor, 0 AS refundsMinor, 0 AS incomeMinor FROM expenses
    UNION ALL
    SELECT a.id, a.owner, a.date, e.categoryId, 0, CASE WHEN a.kind = 'refund' THEN a.amountMinor ELSE 0 END, CASE WHEN a.kind = 'income' THEN a.amountMinor ELSE 0 END FROM cash_entries a LEFT JOIN expenses e ON e.id = a.expenseId AND e.owner = a.owner
  )`;
  const sums = `COALESCE(SUM(expensesMinor), 0) AS expensesMinor, COALESCE(SUM(refundsMinor), 0) AS refundsMinor, COALESCE(SUM(incomeMinor), 0) AS incomeMinor, COUNT(*) AS count`;
  function totals(owner: string, from: string, to: string) {
    return total(
      db
        .prepare(
          `${events} SELECT ${sums} FROM events WHERE owner = ? AND date BETWEEN ? AND ?`,
        )
        .get(owner, from, to) as Record<string, number>,
    );
  }
  const month = db.transaction(
    (owner: string, value: unknown): MonthSummary => {
      const range = monthRange(value);
      const previousRange = {
        from: `${range.previous}-01`,
        to: new Date(new Date(`${range.from}T12:00:00Z`).getTime() - 86400000)
          .toISOString()
          .slice(0, 10),
      };
      const categories = db
        .prepare(
          `${events} SELECT c.id, c.name, SUM(v.expensesMinor) AS expensesMinor, SUM(v.refundsMinor) AS refundsMinor, SUM(v.expensesMinor) - SUM(v.refundsMinor) AS netMinor FROM events v JOIN expense_categories c ON c.id = v.categoryId AND c.owner = v.owner WHERE v.owner = ? AND v.date BETWEEN ? AND ? GROUP BY c.id ORDER BY netMinor DESC, c.name COLLATE NOCASE`,
        )
        .all(owner, range.from, range.to) as CategoryTotal[];
      const days = (
        db
          .prepare(
            `${events} SELECT date, ${sums} FROM events WHERE owner = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date DESC`,
          )
          .all(owner, range.from, range.to) as ({ date: string } & Record<
          string,
          number
        >)[]
      ).map((row) => ({ date: row.date, ...total(row) }));
      return {
        month: range.month,
        from: range.from,
        to: range.to,
        totals: totals(owner, range.from, range.to),
        previous: totals(owner, previousRange.from, previousRange.to),
        categories,
        days,
      };
    },
  );
  return { month };
}
