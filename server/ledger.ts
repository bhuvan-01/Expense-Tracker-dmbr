import { randomUUID, createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { initializeEntries } from "./entries.js";
import {
  CURRENCIES,
  STARTER_CATEGORIES,
  isCurrency,
  parseAmount,
  todayIn,
  validDate,
  validateExpense,
  type ExpenseValues,
  type Preferences,
} from "../src/lib/ledger.js";

export class LedgerError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export function initializeLedger(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_preferences (
      owner TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
      currency TEXT, timezone TEXT, currencyLocked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT NOT NULL, UNIQUE(owner, name COLLATE NOCASE), UNIQUE(owner, id)
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      amountMinor INTEGER NOT NULL CHECK(amountMinor > 0 AND amountMinor <= 999999999),
      currency TEXT NOT NULL, date TEXT NOT NULL, categoryId TEXT NOT NULL,
      merchant TEXT NOT NULL, paymentMethod TEXT NOT NULL, note TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      FOREIGN KEY(owner, categoryId) REFERENCES expense_categories(owner, id)
    );
    CREATE INDEX IF NOT EXISTS expenses_owner_date ON expenses(owner, date DESC, id DESC);
    CREATE INDEX IF NOT EXISTS expenses_owner_category ON expenses(owner, categoryId, date);
    CREATE TABLE IF NOT EXISTS expense_requests (
      owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      requestId TEXT NOT NULL, fingerprint TEXT NOT NULL, expenseId TEXT NOT NULL,
      PRIMARY KEY(owner, requestId)
    );
  `);
  initializeEntries(db);
}
export function createLedger(db: Database.Database) {
  const preferences = (owner: string) =>
    db
      .prepare(
        "SELECT currency, timezone, currencyLocked FROM workspace_preferences WHERE owner = ?",
      )
      .get(owner) as Preferences;
  const workspace = db.transaction((owner: string) => {
    db.prepare(
      "INSERT OR IGNORE INTO workspace_preferences (owner) VALUES (?)",
    ).run(owner);
    const seed = db.prepare(
      "INSERT OR IGNORE INTO expense_categories (id, owner, name) VALUES (?, ?, ?)",
    );
    const seeded = db
      .prepare(
        "SELECT categoriesSeeded FROM workspace_preferences WHERE owner = ?",
      )
      .get(owner) as { categoriesSeeded: number };
    if (!seeded.categoriesSeeded) {
      for (const name of STARTER_CATEGORIES)
        seed.run(randomUUID(), owner, name);
      db.prepare(
        "UPDATE workspace_preferences SET categoriesSeeded = 1 WHERE owner = ?",
      ).run(owner);
    }
    const prefs = preferences(owner);
    return {
      preferences: prefs,
      categories: db
        .prepare(
          "SELECT id, name, archived, version FROM expense_categories WHERE owner = ? ORDER BY name COLLATE NOCASE",
        )
        .all(owner),
      today: todayIn(prefs.timezone || "UTC"),
    };
  });
  function setup(owner: string, body: Record<string, unknown>) {
    if (!isCurrency(body.currency))
      throw new LedgerError(400, "Choose a supported currency.");
    if (typeof body.timezone !== "string" || body.timezone.length > 80)
      throw new LedgerError(400, "Choose a valid timezone.");
    try {
      todayIn(body.timezone);
    } catch {
      throw new LedgerError(400, "Choose a valid timezone.");
    }
    return db.transaction(() => {
      workspace(owner);
      const current = preferences(owner);
      if (current.currencyLocked && current.currency !== body.currency)
        throw new LedgerError(
          409,
          "Currency is fixed after the first expense.",
        );
      db.prepare(
        "UPDATE workspace_preferences SET currency = ?, timezone = ? WHERE owner = ?",
      ).run(body.currency, body.timezone, owner);
      return workspace(owner);
    })();
  }
  function addCategory(owner: string, body: Record<string, unknown>) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 50)
      throw new LedgerError(400, "Use 1–50 characters for the category name.");
    workspace(owner);
    const existing = db
      .prepare(
        "SELECT id, name, archived, version FROM expense_categories WHERE owner = ? AND name = ? COLLATE NOCASE",
      )
      .get(owner, name);
    if (existing) {
      if ((existing as { archived: number }).archived)
        throw new LedgerError(
          409,
          "This category is archived. Restore it in category settings first.",
        );
      return existing;
    }
    const id = randomUUID();
    db.prepare(
      "INSERT INTO expense_categories (id, owner, name) VALUES (?, ?, ?)",
    ).run(id, owner, name);
    return { id, name, archived: 0, version: 1 };
  }
  const selection = `SELECT e.id, e.amountMinor, e.currency, e.date, e.categoryId, c.name AS categoryName, e.merchant, e.paymentMethod, e.note, e.version, e.amountMinor - COALESCE((SELECT SUM(r.amountMinor) FROM cash_entries r WHERE r.owner = e.owner AND r.expenseId = e.id AND r.kind = 'refund'), 0) AS refundableMinor FROM expenses e JOIN expense_categories c ON e.categoryId = c.id AND e.owner = c.owner`;
  function get(owner: string, id: string) {
    const expense = db
      .prepare(`${selection} WHERE e.owner = ? AND e.id = ?`)
      .get(owner, id);
    if (!expense) throw new LedgerError(404, "Expense not found.");
    return expense;
  }
  function validated(
    owner: string,
    body: Record<string, unknown>,
    previousCategory = "",
  ) {
    const prefs = preferences(owner);
    if (!prefs?.currency || !prefs.timezone)
      throw new LedgerError(
        409,
        "Choose your workspace currency and timezone first.",
      );
    if (!isCurrency(body.currency))
      throw new LedgerError(
        400,
        "Send the workspace currency with this expense.",
      );
    if (body.currency !== prefs.currency)
      throw new LedgerError(
        409,
        "Your workspace currency changed. Close the form and reload the page before saving this expense.",
      );
    const values: ExpenseValues = {
      amount: typeof body.amount === "string" ? body.amount : "",
      date: typeof body.date === "string" ? body.date : "",
      categoryId: typeof body.categoryId === "string" ? body.categoryId : "",
      merchant: typeof body.merchant === "string" ? body.merchant.trim() : "",
      paymentMethod:
        typeof body.paymentMethod === "string"
          ? body.paymentMethod
          : "Not specified",
      note: typeof body.note === "string" ? body.note.trim() : "",
    };
    const errors = validateExpense(
      values,
      prefs.currency,
      todayIn(prefs.timezone),
    );
    if (
      values.categoryId &&
      !db
        .prepare("SELECT 1 FROM expense_categories WHERE id = ? AND owner = ?")
        .get(values.categoryId, owner)
    )
      errors.categoryId = "Choose one of your categories.";
    if (Object.keys(errors).length)
      throw new LedgerError(400, "Check the highlighted fields.", errors);
    const category = db
      .prepare(
        "SELECT archived FROM expense_categories WHERE owner = ? AND id = ?",
      )
      .get(owner, values.categoryId) as { archived: number };
    if (category.archived && values.categoryId !== previousCategory)
      throw new LedgerError(400, "Choose an active category.", {
        categoryId: "This category is archived. Choose another category.",
      });
    return {
      ...values,
      amountMinor: parseAmount(values.amount, prefs.currency)!,
      currency: prefs.currency,
    };
  }
  const create = db.transaction(
    (owner: string, body: Record<string, unknown>, requestId: string) => {
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))
        throw new LedgerError(400, "A valid request ID is required.");
      // Check replay before today's-date validation: retries of a confirmed write stay safe.
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            body.currency,
            body.amount,
            body.date,
            body.categoryId,
            body.merchant ?? "",
            body.paymentMethod ?? "Not specified",
            body.note ?? "",
          ]),
        )
        .digest("hex");
      const prior = db
        .prepare(
          "SELECT fingerprint, expenseId FROM expense_requests WHERE owner = ? AND requestId = ?",
        )
        .get(owner, requestId) as
        { fingerprint: string; expenseId: string } | undefined;
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new LedgerError(
            409,
            "This save request was already used for different details.",
          );
        const exists = db
          .prepare("SELECT 1 FROM expenses WHERE owner = ? AND id = ?")
          .get(owner, prior.expenseId);
        if (!exists)
          throw new LedgerError(
            409,
            "This expense was already saved and later deleted. Start a new entry.",
          );
        return { expense: get(owner, prior.expenseId), replay: true };
      }
      const values = validated(owner, body);
      const id = randomUUID(),
        now = new Date().toISOString();
      db.prepare(
        "INSERT INTO expenses (id, owner, amountMinor, currency, date, categoryId, merchant, paymentMethod, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        owner,
        values.amountMinor,
        values.currency,
        values.date,
        values.categoryId,
        values.merchant,
        values.paymentMethod,
        values.note,
        now,
        now,
      );
      db.prepare(
        "INSERT INTO expense_requests (owner, requestId, fingerprint, expenseId) VALUES (?, ?, ?, ?)",
      ).run(owner, requestId, fingerprint, id);
      db.prepare(
        "UPDATE workspace_preferences SET currencyLocked = 1 WHERE owner = ?",
      ).run(owner);
      return { expense: get(owner, id), replay: false };
    },
  );
  const update = db.transaction(
    (owner: string, id: string, body: Record<string, unknown>) => {
      const current = get(owner, id) as { categoryId: string };
      if (!Number.isSafeInteger(body.version) || Number(body.version) < 1)
        throw new LedgerError(400, "An expense version is required.");
      const values = validated(owner, body, current.categoryId);
      const refunds = db
        .prepare(
          "SELECT COALESCE(SUM(amountMinor), 0) AS total, MIN(date) AS firstDate FROM cash_entries WHERE owner = ? AND expenseId = ? AND kind = 'refund'",
        )
        .get(owner, id) as { total: number; firstDate: string | null };
      if (
        values.amountMinor < refunds.total ||
        (refunds.firstDate && values.date > refunds.firstDate)
      )
        throw new LedgerError(
          409,
          "This edit conflicts with recorded refunds. Correct those refunds first.",
        );
      const result = db
        .prepare(
          "UPDATE expenses SET amountMinor = ?, date = ?, categoryId = ?, merchant = ?, paymentMethod = ?, note = ?, version = version + 1, updatedAt = ? WHERE owner = ? AND id = ? AND version = ?",
        )
        .run(
          values.amountMinor,
          values.date,
          values.categoryId,
          values.merchant,
          values.paymentMethod,
          values.note,
          new Date().toISOString(),
          owner,
          id,
          Number(body.version),
        );
      if (!result.changes)
        throw new LedgerError(
          409,
          "This expense changed elsewhere. Close the form, refresh the list, and review the latest entry.",
        );
      return get(owner, id);
    },
  );
  const remove = db.transaction(
    (owner: string, id: string, version: unknown) => {
      get(owner, id);
      if (
        db
          .prepare(
            "SELECT 1 FROM cash_entries WHERE owner = ? AND expenseId = ? AND kind = 'refund'",
          )
          .get(owner, id)
      )
        throw new LedgerError(
          409,
          "This expense has linked refunds. Delete its refunds first.",
        );
      if (!Number.isSafeInteger(version) || Number(version) < 1)
        throw new LedgerError(400, "An expense version is required.");
      if (
        !db
          .prepare(
            "DELETE FROM expenses WHERE owner = ? AND id = ? AND version = ?",
          )
          .run(owner, id, Number(version)).changes
      )
        throw new LedgerError(
          409,
          "This expense changed elsewhere. Refresh the list before deleting it.",
        );
    },
  );
  function list(
    owner: string,
    filters: Record<string, unknown>,
    exportAll = false,
  ) {
    const q = typeof filters.q === "string" ? filters.q.trim() : "";
    if (q.length > 120)
      throw new LedgerError(400, "Search using 120 characters or fewer.");
    const from = filters.from || "",
      to = filters.to || "";
    if (
      (from && !validDate(from)) ||
      (to && !validDate(to)) ||
      (from && to && String(from) > String(to))
    )
      throw new LedgerError(400, "Choose a valid date range.");
    const requested = Number(filters.page || 1);
    if (!Number.isSafeInteger(requested) || requested < 1)
      throw new LedgerError(400, "Choose a valid page.");
    const sortMap: Record<string, string> = {
      date_desc: "e.date DESC, e.id DESC",
      date_asc: "e.date ASC, e.id ASC",
      amount_desc: "e.amountMinor DESC, e.date DESC, e.id DESC",
      amount_asc: "e.amountMinor ASC, e.date DESC, e.id DESC",
    };
    const sort = String(filters.sort || "date_desc");
    if (!Object.hasOwn(sortMap, sort))
      throw new LedgerError(400, "Choose a valid sort order.");
    const clauses = ["e.owner = ?"],
      args: (string | number)[] = [owner];
    if (from) {
      clauses.push("e.date >= ?");
      args.push(String(from));
    }
    if (to) {
      clauses.push("e.date <= ?");
      args.push(String(to));
    }
    if (filters.category) {
      if (typeof filters.category !== "string" || filters.category.length > 80)
        throw new LedgerError(400, "Choose a valid category.");
      clauses.push("e.categoryId = ?");
      args.push(filters.category);
    }
    if (q) {
      const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      clauses.push(
        "(e.merchant LIKE ? ESCAPE '\\' OR e.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')",
      );
      args.push(pattern, pattern, pattern);
    }
    const joined =
      "FROM expenses e JOIN expense_categories c ON e.categoryId = c.id AND e.owner = c.owner";
    const where = clauses.join(" AND ");
    // One read transaction keeps counts, total, and rows consistent under another writer.
    return db.transaction(() => {
      const counts = db
        .prepare(
          `SELECT COUNT(*) AS total, COALESCE(SUM(e.amountMinor), 0) AS totalMinor ${joined} WHERE ${where}`,
        )
        .get(...args) as { total: number; totalMinor: number };
      if (exportAll && counts.total > 10000)
        throw new LedgerError(
          400,
          "Narrow the date range to export up to 10,000 entries at a time.",
        );
      const pageSize = exportAll ? Math.max(1, counts.total) : 25,
        pages = Math.max(1, Math.ceil(counts.total / pageSize)),
        page = exportAll ? 1 : Math.min(requested, pages);
      const items = db
        .prepare(
          `${selection} WHERE ${where} ORDER BY ${sortMap[sort]} LIMIT ? OFFSET ?`,
        )
        .all(...args, pageSize, (page - 1) * pageSize);
      return { items, ...counts, page, pages, pageSize };
    })();
  }
  return {
    workspace,
    setup,
    addCategory,
    get,
    create,
    update,
    remove,
    list,
    currencies: CURRENCIES,
  };
}
