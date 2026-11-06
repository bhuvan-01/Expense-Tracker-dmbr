import type Database from "better-sqlite3";
import { createLedger, LedgerError } from "./ledger.js";
import { cashEntries } from "./entries.js";
import { amountInput, type Expense } from "../src/lib/ledger.js";
import type { EntryKind } from "../src/lib/entries.js";
export function csvText(value: string) {
  // Neutralize spreadsheet formula prefixes, including prefixes hidden behind whitespace/control characters.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportCsv(
  db: Database.Database,
  owner: string,
  body: Record<string, unknown>,
) {
  const kind = body.kind;
  if (
    typeof kind !== "string" ||
    !["all", "expense", "income", "refund"].includes(kind)
  )
    throw new LedgerError(400, "Choose a valid export type.");
  const filters = body.filters === undefined ? {} : body.filters;
  if (!filters || typeof filters !== "object" || Array.isArray(filters))
    throw new LedgerError(400, "Choose valid export filters.");
  const selected =
    kind === "all"
      ? (["expense", "income", "refund"] as EntryKind[])
      : [kind as EntryKind];
  const rows = db.transaction(() =>
    selected.flatMap((type) => {
      const list =
        type === "expense"
          ? createLedger(db).list(
              owner,
              filters as Record<string, unknown>,
              true,
            )
          : cashEntries(db).list(
              owner,
              type,
              filters as Record<string, unknown>,
              true,
            );
      return (list.items as (Expense & { expenseId?: string })[]).map(
        (entry) => ({ ...entry, kind: type }),
      );
    }),
  )();
  if (rows.length > 10000)
    throw new LedgerError(
      400,
      "Narrow the date range to export up to 10,000 entries at a time.",
    );
  if (kind === "all")
    rows.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.kind.localeCompare(b.kind) ||
        a.id.localeCompare(b.id),
    );
  const header = [
    "Type",
    "ID",
    "Date",
    "Currency",
    "Amount",
    "Category",
    "Description",
    "Payment method",
    "Note",
    "Original expense ID",
    "Net spending effect",
    "Income received",
  ];
  const lines = rows.map((entry) =>
    [
      csvText(entry.kind),
      csvText(entry.id),
      csvText(entry.date),
      csvText(entry.currency),
      amountInput(entry.amountMinor, entry.currency),
      csvText(entry.kind === "income" ? "" : entry.categoryName),
      csvText(entry.merchant),
      csvText(entry.paymentMethod),
      csvText(entry.note),
      csvText(entry.expenseId || ""),
      amountInput(
        entry.kind === "expense"
          ? entry.amountMinor
          : entry.kind === "refund"
            ? -entry.amountMinor
            : 0,
        entry.currency,
      ),
      amountInput(
        entry.kind === "income" ? entry.amountMinor : 0,
        entry.currency,
      ),
    ].join(","),
  );
  return (
    "\uFEFF" + [header.map(csvText).join(","), ...lines].join("\r\n") + "\r\n"
  );
}
