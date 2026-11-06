export const CURRENCIES = {
  GBP: { name: "British pound", digits: 2 },
  USD: { name: "US dollar", digits: 2 },
  EUR: { name: "Euro", digits: 2 },
  INR: { name: "Indian rupee", digits: 2 },
  JPY: { name: "Japanese yen", digits: 0 },
  AED: { name: "UAE dirham", digits: 2 },
  BHD: { name: "Bahraini dinar", digits: 3 },
} as const;
export type Currency = keyof typeof CURRENCIES;
export const PAYMENT_METHODS = [
  "Not specified",
  "Card",
  "Cash",
  "Bank transfer",
  "Other",
] as const;
export const STARTER_CATEGORIES = [
  "Groceries",
  "Housing",
  "Bills",
  "Transport",
  "Eating out",
  "Shopping",
  "Health",
  "Entertainment",
  "Education",
  "Travel",
  "Other",
];
export const MAX_MINOR = 999_999_999;
export type Category = {
  id: string;
  name: string;
  archived?: number;
  version?: number;
};
export type Preferences = {
  currency: Currency | null;
  timezone: string | null;
  currencyLocked: number;
};
export type Workspace = {
  preferences: Preferences;
  categories: Category[];
  today: string;
};
export type Expense = {
  refundableMinor?: number;
  id: string;
  amountMinor: number;
  currency: Currency;
  date: string;
  categoryId: string;
  categoryName: string;
  merchant: string;
  paymentMethod: string;
  note: string;
  version: number;
};
export type ExpenseValues = {
  amount: string;
  date: string;
  categoryId: string;
  merchant: string;
  paymentMethod: string;
  note: string;
};
export type ExpenseErrors = Partial<Record<keyof ExpenseValues, string>>;
export type ExpenseFilters = {
  payment?: string;
  q: string;
  from: string;
  to: string;
  category: string;
  sort: string;
  page: number;
};
export type ExpenseList = {
  items: Expense[];
  total: number;
  totalMinor: number;
  page: number;
  pages: number;
  pageSize: number;
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && Object.hasOwn(CURRENCIES, value);
}
export function parseAmount(value: unknown, currency: Currency): number | null {
  if (
    typeof value !== "string" ||
    value.length > 24 ||
    !/^\d+(?:\.\d+)?$/.test(value.trim())
  )
    return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const digits = CURRENCIES[currency].digits;
  if (fraction.length > digits) return null;
  const minor =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  return minor > 0n && minor <= BigInt(MAX_MINOR) ? Number(minor) : null;
}
export function amountInput(minor: number, currency: Currency) {
  const digits = CURRENCIES[currency].digits;
  return (minor / 10 ** digits).toFixed(digits);
}
export function money(minor: number, currency: Currency) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    minor / 10 ** CURRENCIES[currency].digits,
  );
}
export function todayIn(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01"
  )
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}
export function validateExpense(
  values: ExpenseValues,
  currency: Currency,
  today: string,
  requireCategory = true,
): ExpenseErrors {
  const errors: ExpenseErrors = {};
  if (parseAmount(values.amount, currency) === null)
    errors.amount = `Enter a positive amount with up to ${CURRENCIES[currency].digits} decimal places (maximum ${money(MAX_MINOR, currency)}).`;
  if (!validDate(values.date) || values.date > today)
    errors.date = "Choose a valid date from 1900 through today.";
  if (requireCategory && !values.categoryId)
    errors.categoryId = "Choose a category.";
  if (values.merchant.trim().length > 120)
    errors.merchant = "Use 120 characters or fewer.";
  if (
    !PAYMENT_METHODS.includes(
      values.paymentMethod as (typeof PAYMENT_METHODS)[number],
    )
  )
    errors.paymentMethod = "Choose a payment method.";
  if (values.note.length > 1000) errors.note = "Use 1,000 characters or fewer.";
  return errors;
}
