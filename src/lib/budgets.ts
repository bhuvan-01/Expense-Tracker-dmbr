import type { MonthSummary } from "./summary";
export type Budget = {
  scope: string;
  name: string;
  archived: number;
  limitMinor: number | null;
  version: number;
  spentMinor: number;
};
export type BudgetMonth = {
  month: string;
  summary: MonthSummary;
  items: Budget[];
};
