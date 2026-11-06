import { useEffect, useRef, useState } from "react";
import {
  Undo2,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  ReceiptText,
  Search,
  Trash2,
  X,
  LoaderCircle,
} from "lucide-react";
import { downloadCsv } from "../lib/download";
import { api, ApiError } from "../lib/api";
import {
  dateLabel,
  money,
  type Expense,
  type ExpenseFilters,
  type ExpenseList,
  type Workspace,
} from "../lib/ledger";
import { entryLabels, entryPath, type EntryKind } from "../lib/entries";
import { Field } from "./Field";
import { SelectField } from "./SelectField";
import { StatusMessage } from "./StatusMessage";

function readFilters(q = ""): ExpenseFilters {
  const params = new URLSearchParams(window.location.search);
  return {
    q,
    from: params.get("from") || "",
    to: params.get("to") || "",
    category: params.get("category") || "",
    sort: params.get("sort") || "date_desc",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}
function writeFilters(filters: ExpenseFilters, replace = false) {
  const params = new URLSearchParams();
  for (const key of ["from", "to", "category", "sort", "page"] as const)
    if (
      filters[key] &&
      !(key === "page" && filters.page === 1) &&
      !(key === "sort" && filters.sort === "date_desc")
    )
      params.set(key, String(filters[key]));
  const url = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
  if (url !== `${window.location.pathname}${window.location.search}`)
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
}
export function ExpenseHistory({
  workspace,
  kind = "expense",
  onRefund,
  revision,
  onAdd,
  onEdit,
  onDelete,
}: {
  workspace: Workspace;
  kind?: EntryKind;
  onRefund?: (expense: Expense) => void;
  revision: number;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}) {
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState(""),
    [exportNotice, setExportNotice] = useState("");
  async function exportView() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    setExportNotice("");
    try {
      await downloadCsv(kind, { ...filters, q: query });
      setExportNotice(
        "CSV download started. It contains all matching entries, across every page.",
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unable to export.");
    } finally {
      setExporting(false);
    }
  }
  const labels = entryLabels[kind];
  const [filters, setFilters] = useState<ExpenseFilters>(() => readFilters());
  const [query, setQuery] = useState(""),
    [composing, setComposing] = useState(false);
  const [list, setList] = useState<ExpenseList | null>(null);
  const [error, setError] = useState(""),
    [expired, setExpired] = useState(false),
    [pending, setPending] = useState(true),
    [attempt, setAttempt] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusPage = useRef(false);
  useEffect(() => {
    const pop = () => setFilters((current) => readFilters(current.q));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (composing) return;
    const timer = setTimeout(
      () =>
        setFilters((current) =>
          current.q === query ? current : { ...current, q: query, page: 1 },
        ),
      query ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [query, composing]);
  useEffect(() => {
    const abort = new AbortController();
    setPending(true);
    setError("");
    setExpired(false);
    void api<ExpenseList>(`${entryPath(kind)}/search`, {
      method: "POST",
      body: JSON.stringify(filters),
      signal: abort.signal,
    })
      .then((result) => {
        if (abort.signal.aborted) return;
        setList(result);
        setPending(false);
        if (result.page !== filters.page) {
          const corrected = { ...filters, page: result.page };
          writeFilters(corrected, true);
          setFilters(corrected);
        }
        if (focusPage.current) {
          heading.current?.focus();
          focusPage.current = false;
        }
      })
      .catch((err) => {
        if (abort.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Unable to load expenses.",
        );
        setExpired(err instanceof ApiError && err.status === 401);
        setPending(false);
      });
    return () => abort.abort();
  }, [filters, revision, attempt, kind]);
  const change = (key: keyof ExpenseFilters, value: string | number) => {
    const next = {
      ...filters,
      [key]: value,
      ...(key !== "page" ? { page: 1 } : {}),
    };
    writeFilters(next);
    setFilters(next);
    if (key === "page") focusPage.current = true;
  };
  const active = Boolean(
    filters.q || filters.category || filters.from || filters.to,
  );
  const clear = () => {
    setQuery("");
    const next = {
      q: "",
      from: "",
      to: "",
      category: "",
      sort: "date_desc",
      page: 1,
    };
    writeFilters(next);
    setFilters(next);
    search.current?.focus();
  };
  return (
    <section className="history-panel" aria-labelledby="history-title">
      <div className="history-title-row">
        <div>
          <h2 id="history-title" ref={heading} tabIndex={-1}>
            {kind === "expense"
              ? "Your expense history"
              : kind === "income"
                ? "Your income history"
                : "Your refunds"}
          </h2>
          <p>
            {kind === "expense"
              ? "Everyday spending, all in one place."
              : kind === "income"
                ? "Salary, freelance work, and other money received."
                : "Refunds are linked to purchases and reduce spending on the refund date."}
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={exporting || pending || !list?.total}
          onClick={() => void exportView()}
        >
          {exporting ? "Preparing CSV…" : "Export this view"}
        </button>
        {active && (
          <button type="button" className="text-button" onClick={clear}>
            Clear filters
          </button>
        )}
      </div>
      {exportError && (
        <StatusMessage error>
          {exportError}{" "}
          <button
            className="text-button"
            type="button"
            disabled={exporting}
            onClick={() => void exportView()}
          >
            Retry export
          </button>
        </StatusMessage>
      )}
      {exportNotice && <StatusMessage>{exportNotice}</StatusMessage>}
      <div className="ledger-filters">
        <div className="field history-search">
          <label htmlFor="expense-search">Search {labels.plural}</label>
          <div className="search-control">
            <Search size={18} aria-hidden="true" />
            <input
              ref={search}
              id="expense-search"
              type="search"
              maxLength={120}
              placeholder="Search merchant, category, or note"
              value={query}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value)
                  setFilters((current) => ({ ...current, q: "", page: 1 }));
              }}
            />
            {query && (
              <button
                type="button"
                className="icon-button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setFilters((current) => ({ ...current, q: "", page: 1 }));
                  search.current?.focus();
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {kind !== "income" && (
          <SelectField
            id="filter-category"
            label="Category"
            value={filters.category}
            onChange={(event) => change("category", event.target.value)}
          >
            <option value="">All categories</option>
            {workspace.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
        )}
        <Field
          id="filter-from"
          label="From date"
          type="date"
          value={filters.from}
          min="1900-01-01"
          onChange={(event) => change("from", event.target.value)}
        />
        <Field
          id="filter-to"
          label="To date"
          type="date"
          value={filters.to}
          min="1900-01-01"
          onChange={(event) => change("to", event.target.value)}
        />
      </div>
      <div className="history-toolbar">
        <p className="result-count" role="status">
          {pending ? (
            <>
              <LoaderCircle className="spin" size={14} aria-hidden="true" />{" "}
              Updating {labels.plural}…
            </>
          ) : list ? (
            <>
              <strong>{list.total}</strong>{" "}
              {list.total === 1 ? labels.singular : labels.plural}
              {active ? " matching your filters" : " recorded"}
            </>
          ) : (
            labels.plural
          )}
        </p>
        <div className="sort-control">
          <ArrowDownUp size={15} aria-hidden="true" />
          <SelectField
            id="expense-sort"
            label={`Sort ${labels.plural}`}
            value={filters.sort}
            onChange={(event) => change("sort", event.target.value)}
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Highest amount</option>
            <option value="amount_asc">Lowest amount</option>
          </SelectField>
        </div>
      </div>
      {error && (
        <StatusMessage error>
          {error}
          {list && <p>Showing the last loaded results.</p>}
          <div className="error-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setAttempt(attempt + 1)}
            >
              Try again
            </button>
            {expired && (
              <a href="/sign-in" target="_blank" rel="noopener noreferrer">
                Sign in in a new tab
              </a>
            )}
          </div>
        </StatusMessage>
      )}
      <div className="history-results" aria-busy={pending}>
        {list && list.items.length > 0 ? (
          <>
            <div className="history-total">
              <span>
                {labels.total}
                {active ? " in this view" : ` across your ${labels.plural}`}
              </span>
              <strong>
                {money(list.totalMinor, workspace.preferences.currency!)}
              </strong>
            </div>
            <div className="expense-table-wrap">
              <table className="expense-table">
                <caption className="sr-only">
                  Recorded expenses. Edit or delete individual entries using the
                  actions in each row.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      {kind === "expense"
                        ? "Expense"
                        : kind === "income"
                          ? "Income"
                          : "Refund"}
                    </th>
                    <th scope="col">Date</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="numeric">
                      Amount ({workspace.preferences.currency})
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((expense) => (
                    <tr key={expense.id}>
                      <td className="description-cell">
                        <span className="transaction-icon" aria-hidden="true">
                          <ReceiptText size={18} />
                        </span>
                        <span>
                          <strong>
                            {expense.merchant || expense.categoryName}
                          </strong>
                          <small>
                            {expense.paymentMethod}
                            {expense.note && (
                              <span className="expense-note">
                                {" "}
                                · {expense.note}
                              </span>
                            )}
                          </small>
                        </span>
                      </td>
                      <td className="date-cell">
                        <time dateTime={expense.date}>
                          {dateLabel(expense.date)}
                        </time>
                      </td>
                      <td className="category-cell">
                        <span className="category-pill">
                          {expense.categoryName}
                        </span>
                      </td>
                      <td className="numeric amount-cell">
                        {money(expense.amountMinor, expense.currency)}
                      </td>
                      <td className="actions-cell">
                        {kind === "expense" &&
                          onRefund &&
                          (expense.refundableMinor ?? expense.amountMinor) >
                            0 && (
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Record refund for ${expense.merchant || expense.categoryName}`}
                              title="Record refund"
                              disabled={pending}
                              onClick={() => onRefund(expense)}
                            >
                              <Undo2 size={16} aria-hidden="true" />
                            </button>
                          )}
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit ${expense.merchant || expense.categoryName}`}
                          title={`Edit ${labels.singular}`}
                          disabled={pending}
                          onClick={() => onEdit(expense)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger-icon"
                          aria-label={`Delete ${expense.merchant || expense.categoryName}`}
                          title={`Delete ${labels.singular}`}
                          disabled={pending}
                          onClick={() => onDelete(expense)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="pagination" aria-label="Expense pages">
              <p>
                {(list.page - 1) * list.pageSize + 1}–
                {Math.min(list.page * list.pageSize, list.total)} of{" "}
                {list.total}
              </p>
              <div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={pending || list.page <= 1}
                  onClick={() => change("page", list.page - 1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" /> Previous
                </button>
                <span>
                  Page {list.page} of {list.pages}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={pending || list.page >= list.pages}
                  onClick={() => change("page", list.page + 1)}
                >
                  Next <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </nav>
          </>
        ) : !pending && !error ? (
          <div className="empty-ledger">
            <span>
              <ReceiptText size={27} aria-hidden="true" />
            </span>
            <h3>
              {active
                ? `No matching ${labels.plural}`
                : "Small steps. A clearer picture."}
            </h3>
            <p>
              {active
                ? "Try a different search or clear your filters."
                : kind === "expense"
                  ? "Add your first expense. A coffee, a grocery shop, a trip home — start with today."
                  : kind === "income"
                    ? "Record money you receive to see how it compares with your spending."
                    : "Open Expenses and use Record refund beside the original purchase."}
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={active ? clear : onAdd}
            >
              {active
                ? "Clear filters"
                : kind === "expense"
                  ? "Add your first expense"
                  : kind === "income"
                    ? "Add your first income"
                    : "Go to expenses"}
            </button>
          </div>
        ) : !list && pending ? (
          <p className="loading-status history-loading">
            Loading your {labels.plural}…
          </p>
        ) : null}
      </div>
    </section>
  );
}
