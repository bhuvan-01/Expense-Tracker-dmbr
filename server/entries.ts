import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { LedgerError } from "./ledger.js";
import {
  isCurrency,
  parseAmount,
  todayIn,
  validDate,
  PAYMENT_METHODS,
  type Preferences,
} from "../src/lib/ledger.js";

export type CashKind = "income" | "refund";
export function initializeEntries(db: Database.Database) {
  const columns = (table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (row) => row.name,
    );
  if (!columns("workspace_preferences").includes("categoriesSeeded")) {
    db.exec(
      "ALTER TABLE workspace_preferences ADD COLUMN categoriesSeeded INTEGER NOT NULL DEFAULT 0; UPDATE workspace_preferences SET categoriesSeeded = 1 WHERE EXISTS (SELECT 1 FROM expense_categories WHERE owner = workspace_preferences.owner);",
    );
  }
  if (!columns("expense_categories").includes("archived"))
    db.exec(
      "ALTER TABLE expense_categories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;",
    );
  if (!columns("expense_categories").includes("version"))
    db.exec(
      "ALTER TABLE expense_categories ADD COLUMN version INTEGER NOT NULL DEFAULT 1;",
    );
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_entries (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('income', 'refund')),
      amountMinor INTEGER NOT NULL CHECK(amountMinor > 0 AND amountMinor <= 999999999),
      currency TEXT NOT NULL, date TEXT NOT NULL, expenseId TEXT REFERENCES expenses(id),
      merchant TEXT NOT NULL, paymentMethod TEXT NOT NULL, note TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cash_entries_owner_date ON cash_entries(owner, kind, date DESC, id DESC);
    CREATE INDEX IF NOT EXISTS cash_entries_expense ON cash_entries(expenseId, owner);
    CREATE TABLE IF NOT EXISTS cash_requests (
      owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, kind TEXT NOT NULL,
      requestId TEXT NOT NULL, fingerprint TEXT NOT NULL, entryId TEXT NOT NULL,
      PRIMARY KEY(owner, kind, requestId)
    );
  `);
}
export function cashEntries(db: Database.Database) {
  const selection = `SELECT a.id, a.kind, a.amountMinor, a.currency, a.date, a.expenseId, a.merchant, a.paymentMethod, a.note, a.version, COALESCE(e.categoryId, '') AS categoryId, COALESCE(c.name, 'Income') AS categoryName FROM cash_entries a LEFT JOIN expenses e ON e.id = a.expenseId AND e.owner = a.owner LEFT JOIN expense_categories c ON c.id = e.categoryId AND c.owner = e.owner`;
  function get(owner: string, kind: CashKind, id: string) {
    const entry = db
      .prepare(`${selection} WHERE a.owner = ? AND a.kind = ? AND a.id = ?`)
      .get(owner, kind, id);
    if (!entry) throw new LedgerError(404, "Entry not found.");
    return entry;
  }
  function validate(
    owner: string,
    kind: CashKind,
    body: Record<string, unknown>,
    editingId = "",
  ) {
    const prefs = db
      .prepare(
        "SELECT currency, timezone FROM workspace_preferences WHERE owner = ?",
      )
      .get(owner) as Preferences | undefined;
    if (!prefs?.currency || !prefs.timezone)
      throw new LedgerError(
        409,
        "Choose your workspace currency and timezone first.",
      );
    if (!isCurrency(body.currency) || body.currency !== prefs.currency)
      throw new LedgerError(
        409,
        "Your workspace currency changed. Reload your workspace before saving.",
      );
    const amountMinor = parseAmount(body.amount, prefs.currency);
    const fields: Record<string, string> = {};
    if (amountMinor === null)
      fields.amount =
        "Enter a positive amount using the precision of your workspace currency.";
    if (!validDate(body.date) || body.date > todayIn(prefs.timezone))
      fields.date = "Choose a valid date from 1900 through today.";
    const merchant =
      typeof body.merchant === "string" ? body.merchant.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const paymentMethod =
      typeof body.paymentMethod === "string"
        ? body.paymentMethod
        : "Not specified";
    if (merchant.length > 120) fields.merchant = "Use 120 characters or fewer.";
    if (note.length > 1000) fields.note = "Use 1,000 characters or fewer.";
    if (
      !PAYMENT_METHODS.includes(
        paymentMethod as (typeof PAYMENT_METHODS)[number],
      )
    )
      fields.paymentMethod = "Choose a payment method.";
    let expenseId: string | null = null;
    if (kind === "refund") {
      expenseId = typeof body.expenseId === "string" ? body.expenseId : "";
      const original = db
        .prepare(
          "SELECT amountMinor, date FROM expenses WHERE owner = ? AND id = ?",
        )
        .get(owner, expenseId) as
        { amountMinor: number; date: string } | undefined;
      if (!original) throw new LedgerError(404, "Original expense not found.");
      if (typeof body.date === "string" && body.date < original.date)
        fields.date = "A refund cannot be dated before its original expense.";
      const refunded = db
        .prepare(
          "SELECT COALESCE(SUM(amountMinor), 0) AS amount FROM cash_entries WHERE owner = ? AND kind = 'refund' AND expenseId = ? AND id <> ?",
        )
        .get(owner, expenseId, editingId) as { amount: number };
      if (
        amountMinor !== null &&
        refunded.amount + amountMinor > original.amountMinor
      )
        fields.amount =
          "Refunds cannot exceed the original expense amount. Review the existing refunds first.";
    }
    if (Object.keys(fields).length)
      throw new LedgerError(400, "Check the highlighted fields.", fields);
    return {
      amountMinor: amountMinor!,
      currency: prefs.currency,
      date: String(body.date),
      expenseId,
      merchant,
      paymentMethod,
      note,
    };
  }
  const create = db.transaction(
    (
      owner: string,
      kind: CashKind,
      body: Record<string, unknown>,
      key: string,
    ) => {
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(key))
        throw new LedgerError(400, "A valid request ID is required.");
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            body.currency,
            body.amount,
            body.date,
            body.expenseId ?? null,
            body.merchant ?? "",
            body.paymentMethod ?? "Not specified",
            body.note ?? "",
          ]),
        )
        .digest("hex");
      const prior = db
        .prepare(
          "SELECT fingerprint, entryId FROM cash_requests WHERE owner = ? AND kind = ? AND requestId = ?",
        )
        .get(owner, kind, key) as
        { fingerprint: string; entryId: string } | undefined;
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new LedgerError(
            409,
            "This save request was already used for different details.",
          );
        if (
          !db
            .prepare(
              "SELECT 1 FROM cash_entries WHERE owner = ? AND kind = ? AND id = ?",
            )
            .get(owner, kind, prior.entryId)
        )
          throw new LedgerError(
            409,
            "This entry was saved and later deleted. Start a new entry.",
          );
        return { entry: get(owner, kind, prior.entryId), replay: true };
      }
      const value = validate(owner, kind, body),
        id = randomUUID(),
        now = new Date().toISOString();
      db.prepare(
        "INSERT INTO cash_entries (id, owner, kind, amountMinor, currency, date, expenseId, merchant, paymentMethod, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        owner,
        kind,
        value.amountMinor,
        value.currency,
        value.date,
        value.expenseId,
        value.merchant,
        value.paymentMethod,
        value.note,
        now,
        now,
      );
      db.prepare(
        "INSERT INTO cash_requests (owner, kind, requestId, fingerprint, entryId) VALUES (?, ?, ?, ?, ?)",
      ).run(owner, kind, key, fingerprint, id);
      db.prepare(
        "UPDATE workspace_preferences SET currencyLocked = 1 WHERE owner = ?",
      ).run(owner);
      return { entry: get(owner, kind, id), replay: false };
    },
  );
  const update = db.transaction(
    (
      owner: string,
      kind: CashKind,
      id: string,
      body: Record<string, unknown>,
    ) => {
      const current = get(owner, kind, id) as { expenseId: string | null };
      if (!Number.isSafeInteger(body.version) || Number(body.version) < 1)
        throw new LedgerError(400, "An entry version is required.");
      if (kind === "refund" && body.expenseId !== current.expenseId)
        throw new LedgerError(
          409,
          "A refund must stay linked to its original expense.",
        );
      const value = validate(owner, kind, body, id);
      const result = db
        .prepare(
          "UPDATE cash_entries SET amountMinor = ?, date = ?, merchant = ?, paymentMethod = ?, note = ?, version = version + 1, updatedAt = ? WHERE owner = ? AND kind = ? AND id = ? AND version = ?",
        )
        .run(
          value.amountMinor,
          value.date,
          value.merchant,
          value.paymentMethod,
          value.note,
          new Date().toISOString(),
          owner,
          kind,
          id,
          Number(body.version),
        );
      if (!result.changes)
        throw new LedgerError(
          409,
          "This entry changed elsewhere. Close the form and refresh the list.",
        );
      return get(owner, kind, id);
    },
  );
  const remove = db.transaction(
    (owner: string, kind: CashKind, id: string, version: unknown) => {
      get(owner, kind, id);
      if (!Number.isSafeInteger(version) || Number(version) < 1)
        throw new LedgerError(400, "An entry version is required.");
      if (
        !db
          .prepare(
            "DELETE FROM cash_entries WHERE owner = ? AND kind = ? AND id = ? AND version = ?",
          )
          .run(owner, kind, id, Number(version)).changes
      )
        throw new LedgerError(
          409,
          "This entry changed elsewhere. Refresh the list before deleting.",
        );
    },
  );
  function list(
    owner: string,
    kind: CashKind,
    filters: Record<string, unknown>,
    exportAll = false,
  ) {
    const q = typeof filters.q === "string" ? filters.q.trim() : "";
    const from = filters.from || "",
      to = filters.to || "";
    const requested = Number(filters.page || 1);
    if (
      q.length > 120 ||
      (from && !validDate(from)) ||
      (to && !validDate(to)) ||
      (from && to && String(from) > String(to)) ||
      !Number.isSafeInteger(requested) ||
      requested < 1
    )
      throw new LedgerError(400, "Choose valid search filters and dates.");
    const orders: Record<string, string> = {
      date_desc: "a.date DESC, a.id DESC",
      date_asc: "a.date ASC, a.id ASC",
      amount_desc: "a.amountMinor DESC, a.date DESC, a.id DESC",
      amount_asc: "a.amountMinor ASC, a.date DESC, a.id DESC",
    };
    const sort = String(filters.sort || "date_desc");
    if (!Object.hasOwn(orders, sort))
      throw new LedgerError(400, "Choose a valid sort order.");
    const clauses = ["a.owner = ?", "a.kind = ?"],
      args: (string | number)[] = [owner, kind];
    if (from) {
      clauses.push("a.date >= ?");
      args.push(String(from));
    }
    if (to) {
      clauses.push("a.date <= ?");
      args.push(String(to));
    }
    if (filters.category) {
      clauses.push("e.categoryId = ?");
      args.push(String(filters.category));
    }
    if (q) {
      clauses.push(
        "(a.merchant LIKE ? ESCAPE '\\' OR a.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')",
      );
      const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      args.push(pattern, pattern, pattern);
    }
    const where = clauses.join(" AND ");
    const join =
      "FROM cash_entries a LEFT JOIN expenses e ON e.id = a.expenseId AND e.owner = a.owner LEFT JOIN expense_categories c ON c.id = e.categoryId AND c.owner = e.owner";
    return db.transaction(() => {
      const counts = db
        .prepare(
          `SELECT COUNT(*) AS total, COALESCE(SUM(a.amountMinor), 0) AS totalMinor ${join} WHERE ${where}`,
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
          `${selection} WHERE ${where} ORDER BY ${orders[sort]} LIMIT ? OFFSET ?`,
        )
        .all(...args, pageSize, (page - 1) * pageSize);
      return { items, ...counts, page, pages, pageSize };
    })();
  }
  const categoryUpdate = db.transaction(
    (owner: string, id: string, body: Record<string, unknown>) => {
      const current = db
        .prepare(
          "SELECT name, archived, version FROM expense_categories WHERE owner = ? AND id = ?",
        )
        .get(owner, id) as
        { name: string; archived: number; version: number } | undefined;
      if (!current) throw new LedgerError(404, "Category not found.");
      if (
        !Number.isSafeInteger(body.version) ||
        body.version !== current.version
      )
        throw new LedgerError(
          409,
          "This category changed elsewhere. Reopen settings to refresh it.",
        );
      const name =
        typeof body.name === "string" ? body.name.trim() : current.name;
      if (
        !name ||
        name.length > 50 ||
        (body.archived !== undefined && typeof body.archived !== "boolean")
      )
        throw new LedgerError(400, "Use a category name of 1–50 characters.");
      if (
        db
          .prepare(
            "SELECT 1 FROM expense_categories WHERE owner = ? AND name = ? COLLATE NOCASE AND id <> ?",
          )
          .get(owner, name, id)
      )
        throw new LedgerError(409, "Another category already uses this name.");
      db.prepare(
        "UPDATE expense_categories SET name = ?, archived = ?, version = version + 1 WHERE owner = ? AND id = ?",
      ).run(
        name,
        typeof body.archived === "boolean"
          ? Number(body.archived)
          : current.archived,
        owner,
        id,
      );
      return db
        .prepare(
          "SELECT id, name, archived, version FROM expense_categories WHERE owner = ? AND id = ?",
        )
        .get(owner, id);
    },
  );
  return { create, get, update, remove, list, categoryUpdate };
}
