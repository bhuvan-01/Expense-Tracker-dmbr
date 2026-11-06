import type { Expense } from "./ledger";
export type EntryKind = "expense" | "income" | "refund";
export type MoneyEntry = Expense & { kind?: EntryKind; expenseId?: string };
export const entryLabels = {
  expense: {
    singular: "expense",
    plural: "expenses",
    create: "Add expense",
    save: "Save expense",
    total: "Total spent",
  },
  income: {
    singular: "income entry",
    plural: "income entries",
    create: "Add income",
    save: "Save income",
    total: "Total income",
  },
  refund: {
    singular: "refund",
    plural: "refunds",
    create: "Record refund",
    save: "Save refund",
    total: "Total refunded",
  },
} as const;
export const entryPath = (kind: EntryKind) =>
  kind === "expense" ? "/expenses" : kind === "income" ? "/income" : "/refunds";
