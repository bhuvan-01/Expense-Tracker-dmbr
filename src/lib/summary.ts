export type Totals = {
  expensesMinor: number;
  refundsMinor: number;
  incomeMinor: number;
  netMinor: number;
  differenceMinor: number;
  count: number;
};
export type CategoryTotal = {
  id: string;
  name: string;
  expensesMinor: number;
  refundsMinor: number;
  netMinor: number;
};
export type MonthSummary = {
  month: string;
  from: string;
  to: string;
  totals: Totals;
  previous: Totals;
  categories: CategoryTotal[];
  days: ({ date: string } & Totals)[];
};
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
