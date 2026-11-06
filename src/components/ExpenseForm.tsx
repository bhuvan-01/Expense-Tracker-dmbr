import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import {
  amountInput,
  CURRENCIES,
  PAYMENT_METHODS,
  todayIn,
  validateExpense,
  type Category,
  type Currency,
  type Expense,
  type ExpenseErrors,
  type ExpenseValues,
  type Workspace,
} from "../lib/ledger";
import {
  entryLabels,
  entryPath,
  type EntryKind,
  type MoneyEntry,
} from "../lib/entries";
import { money } from "../lib/ledger";
import { Field } from "./Field";
import { SelectField } from "./SelectField";
import { Dialog } from "./Dialog";
import { LeaveDialog } from "./LeaveDialog";
import { StatusMessage } from "./StatusMessage";

export function ExpenseForm({
  expense,
  kind = "expense",
  refundOf,
  workspace,
  onClose,
  onSaved,
  onCategory,
}: {
  expense: MoneyEntry | null;
  kind?: EntryKind;
  refundOf?: Expense;
  workspace: Workspace;
  onClose: () => void;
  onSaved: () => void;
  onCategory: (category: Category) => void;
}) {
  const labels = entryLabels[kind];
  const currency = workspace.preferences.currency as Currency;
  const today = todayIn(workspace.preferences.timezone!);
  const initial: ExpenseValues = {
    amount: expense ? amountInput(expense.amountMinor, currency) : "",
    date: expense?.date || today,
    categoryId: expense?.categoryId || refundOf?.categoryId || "",
    merchant: expense?.merchant || refundOf?.merchant || "",
    paymentMethod: expense?.paymentMethod || "Not specified",
    note: expense?.note || "",
  };
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ExpenseErrors>({});
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [unknownSave, setUnknownSave] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryPending, setCategoryPending] = useState(false);
  const request = useRef({ id: crypto.randomUUID(), snapshot: "" });
  const saving = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initial) || Boolean(categoryName);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function close() {
    if (saving.current || categoryPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function update(key: keyof ExpenseValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || categoryPending) return;
    const issues = validateExpense(values, currency, today, kind === "expense");
    setErrors(issues);
    setError("");
    const first = Object.keys(issues)[0];
    if (first) {
      document.getElementById(`expense-${first}`)?.focus();
      return;
    }
    const body = {
      ...values,
      currency,
      version: expense?.version,
      expenseId: expense?.expenseId || refundOf?.id,
    };
    const snapshot = JSON.stringify(body);
    if (request.current.snapshot && request.current.snapshot !== snapshot)
      request.current.id = crypto.randomUUID();
    request.current.snapshot = snapshot;
    saving.current = true;
    setPending(true);
    try {
      await api<Expense>(
        expense ? `${entryPath(kind)}/${expense.id}` : entryPath(kind),
        {
          method: expense ? "PATCH" : "POST",
          headers: { "Idempotency-Key": request.current.id },
          body: snapshot,
        },
      );
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields || {});
        setSessionExpired(err.status === 401);
        if (!expense && (err.status === 0 || err.status >= 500))
          setUnknownSave(true);
      }
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save. Please try again.",
      );
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  async function addCategory() {
    if (categoryPending || saving.current) return;
    if (!categoryName.trim() || categoryName.trim().length > 50) {
      setCategoryError("Use 1–50 characters for the category name.");
      document.getElementById("new-category")?.focus();
      return;
    }
    setCategoryPending(true);
    setCategoryError("");
    try {
      const category = await api<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName }),
      });
      onCategory(category);
      update("categoryId", category.id);
      setCategoryName("");
    } catch (err) {
      setCategoryError(
        err instanceof Error ? err.message : "Unable to add this category.",
      );
    } finally {
      setCategoryPending(false);
    }
  }
  return (
    <>
      <Dialog
        open
        titleId="expense-form-title"
        className="expense-dialog"
        onRequestClose={close}
      >
        <header className="dialog-header">
          <div>
            <p className="form-step">YOUR EVERYDAY LEDGER</p>
            <h2 id="expense-form-title">
              {expense ? `Edit ${labels.singular}` : labels.create}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={`Close ${labels.singular} form`}
            onClick={close}
            disabled={pending || categoryPending}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <form noValidate onSubmit={submit} aria-busy={pending}>
          <div className="expense-form-body">
            {error && (
              <div ref={errorRef} tabIndex={-1}>
                <StatusMessage error>
                  {error}
                  {unknownSave && (
                    <p>
                      The save couldn't be confirmed. Retry these same details
                      to avoid creating a duplicate, or close the form and check
                      your history.
                    </p>
                  )}
                  {sessionExpired && (
                    <p>
                      <a
                        href="/sign-in"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Sign in in a new tab
                      </a>
                      , then retry your save here.
                    </p>
                  )}
                </StatusMessage>
              </div>
            )}
            {refundOf && (
              <p className="refund-context">
                Refund for{" "}
                <strong>{refundOf.merchant || refundOf.categoryName}</strong>.
                Available to refund:{" "}
                {money(
                  refundOf.refundableMinor ?? refundOf.amountMinor,
                  currency,
                )}
                . Recorded on the refund date.
              </p>
            )}
            <fieldset
              className="expense-fields"
              aria-label={`${labels.singular} details`}
              disabled={pending || unknownSave}
            >
              <div className="amount-field">
                <Field
                  id="expense-amount"
                  label={`Amount (${currency})`}
                  type="text"
                  inputMode={
                    CURRENCIES[currency].digits ? "decimal" : "numeric"
                  }
                  placeholder={
                    CURRENCIES[currency].digits
                      ? `0.${"0".repeat(CURRENCIES[currency].digits)}`
                      : "0"
                  }
                  value={values.amount}
                  onChange={(event) => update("amount", event.target.value)}
                  error={errors.amount}
                  autoFocus
                  required
                  disabled={pending}
                  autoComplete="off"
                />
              </div>
              <div className="form-grid">
                {kind === "expense" && (
                  <SelectField
                    id="expense-categoryId"
                    label="Category"
                    value={values.categoryId}
                    onChange={(event) =>
                      update("categoryId", event.target.value)
                    }
                    error={errors.categoryId}
                    required
                    disabled={pending || categoryPending}
                  >
                    <option value="">Choose a category</option>
                    {workspace.categories
                      .filter(
                        (category) =>
                          !category.archived ||
                          category.id === values.categoryId,
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </SelectField>
                )}
                <Field
                  id="expense-date"
                  label="Date"
                  type="date"
                  min="1900-01-01"
                  max={today}
                  value={values.date}
                  onChange={(event) => update("date", event.target.value)}
                  error={errors.date}
                  disabled={pending}
                  required
                />
              </div>
              {kind === "expense" && (
                <details className="category-disclosure">
                  <summary>Add a new category</summary>
                  <div className="new-category-row">
                    <Field
                      id="new-category"
                      label="New category name"
                      value={categoryName}
                      onChange={(event) => {
                        setCategoryName(event.target.value);
                        setCategoryError("");
                      }}
                      error={categoryError}
                      maxLength={50}
                      disabled={pending || categoryPending}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={addCategory}
                      disabled={pending || categoryPending}
                    >
                      {categoryPending ? (
                        <LoaderCircle
                          className="spin"
                          size={16}
                          aria-hidden="true"
                        />
                      ) : (
                        <Plus size={16} aria-hidden="true" />
                      )}{" "}
                      Add category
                    </button>
                  </div>
                </details>
              )}
              <Field
                id="expense-merchant"
                label={
                  kind === "income"
                    ? "Source or description (optional)"
                    : "Merchant or description (optional)"
                }
                type="text"
                placeholder="e.g. Weekly grocery shop"
                value={values.merchant}
                onChange={(event) => update("merchant", event.target.value)}
                error={errors.merchant}
                maxLength={120}
                disabled={pending}
              />
              <SelectField
                id="expense-paymentMethod"
                label="Payment method (optional)"
                value={values.paymentMethod}
                onChange={(event) =>
                  update("paymentMethod", event.target.value)
                }
                error={errors.paymentMethod}
                disabled={pending}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </SelectField>
              <div className="field">
                <label htmlFor="expense-note">Note (optional)</label>
                <textarea
                  id="expense-note"
                  value={values.note}
                  onChange={(event) => update("note", event.target.value)}
                  maxLength={1000}
                  rows={3}
                  style={{ resize: "none" }}
                  aria-invalid={Boolean(errors.note)}
                  aria-describedby={
                    errors.note ? "expense-note-error" : undefined
                  }
                  disabled={pending}
                />
                {errors.note && (
                  <p className="field-error" id="expense-note-error">
                    {errors.note}
                  </p>
                )}
              </div>
            </fieldset>
          </div>
          <footer className="dialog-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={close}
              disabled={pending || categoryPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={pending || categoryPending}
            >
              {pending && (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              )}
              {pending ? "Saving…" : expense ? "Save changes" : labels.save}
            </button>
          </footer>
        </form>
      </Dialog>
      <LeaveDialog
        destination={discard ? "discard" : null}
        onCancel={() => setDiscard(false)}
        onDiscard={onClose}
      />
    </>
  );
}
