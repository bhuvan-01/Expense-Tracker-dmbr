import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { amountInput, money, todayIn, type Workspace } from "../lib/ledger";
import type { Budget, BudgetMonth } from "../lib/budgets";
import { monthLabel } from "../lib/summary";
import { Dialog } from "./Dialog";
import { LeaveDialog } from "./LeaveDialog";
import { Field } from "./Field";
import { StatusMessage } from "./StatusMessage";
function BudgetEditor({
  budget,
  month,
  workspace,
  onClose,
  onSaved,
}: {
  budget: Budget;
  month: string;
  workspace: Workspace;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currency = workspace.preferences.currency!;
  const initial =
    budget.limitMinor === null ? "" : amountInput(budget.limitMinor, currency);
  const [amount, setAmount] = useState(initial),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false),
    [removing, setRemoving] = useState(false);
  const dirty = amount !== initial;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const close = () => {
    if (!pending) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  };
  async function save(remove = false) {
    if (pending) return;
    if (!remove && !amount.trim()) {
      setError("Enter a budget amount. Zero means no spending planned.");
      document.getElementById("budget-amount")?.focus();
      return;
    }
    setPending(true);
    setError("");
    try {
      await api<BudgetMonth>("/budgets", {
        method: "PUT",
        body: JSON.stringify({
          month,
          scope: budget.scope,
          currency,
          version: budget.version,
          amount: remove ? null : amount,
        }),
      });
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save your budget.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Dialog
        open
        titleId="budget-title"
        className="settings-dialog"
        onRequestClose={close}
      >
        <div className="category-manager">
          <h2 id="budget-title">
            {budget.limitMinor === null ? "Set" : "Edit"}{" "}
            {budget.scope ? `${budget.name} budget` : "overall budget"}
          </h2>
          <p>
            {monthLabel(month)} · {currency}
          </p>
          <p className="budget-explanation">
            This limit applies only to this month. Overall and category limits
            are independent. Enter zero to plan no spending.
          </p>
          {error && <StatusMessage error>{error}</StatusMessage>}
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field
              id="budget-amount"
              label={`Budget amount (${currency})`}
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={pending}
              required
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={pending}
                onClick={close}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save budget"}
              </button>
            </div>
            {budget.limitMinor !== null && (
              <button
                type="button"
                className="text-button danger-text"
                disabled={pending}
                onClick={() => setRemoving(true)}
              >
                Remove budget limit
              </button>
            )}
          </form>
        </div>
      </Dialog>
      {removing && (
        <Dialog
          open
          titleId="remove-budget-title"
          className="confirm-dialog"
          onRequestClose={() => {
            if (!pending) setRemoving(false);
          }}
        >
          <h2 id="remove-budget-title">Remove this budget limit?</h2>
          <p>
            {budget.name} for {monthLabel(month)}. Your recorded entries are
            preserved.
          </p>
          {error && <StatusMessage error>{error}</StatusMessage>}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              autoFocus
              disabled={pending}
              onClick={() => setRemoving(false)}
            >
              Keep limit
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={pending}
              onClick={() => void save(true)}
            >
              {pending ? "Removing…" : "Remove limit"}
            </button>
          </div>
        </Dialog>
      )}
      <LeaveDialog
        destination={discard ? "budget" : null}
        onCancel={() => setDiscard(false)}
        onDiscard={onClose}
      />
    </>
  );
}
export function Budgets({
  workspace,
  revision,
  onSaved,
}: {
  workspace: Workspace;
  revision: number;
  onSaved: () => void;
}) {
  const [month, setMonth] = useState(() =>
    todayIn(workspace.preferences.timezone!).slice(0, 7),
  );
  const [data, setData] = useState<BudgetMonth | null>(null),
    [pending, setPending] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [editing, setEditing] = useState<Budget | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setPending(true);
    setError("");
    setData(null);
    void api<BudgetMonth>(`/budgets?month=${encodeURIComponent(month)}`, {
      signal: abort.signal,
    })
      .then((result) => {
        if (!abort.signal.aborted) {
          setData(result);
          setPending(false);
        }
      })
      .catch((err) => {
        if (!abort.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Unable to load budgets.",
          );
          setPending(false);
        }
      });
    return () => abort.abort();
  }, [month, revision, attempt]);
  const currency = workspace.preferences.currency!;
  return (
    <section
      className="history-panel overview-panel"
      aria-labelledby="budgets-title"
    >
      <header className="period-heading">
        <div>
          <h2 id="budgets-title">Monthly budgets</h2>
          <p>Plan a limit. Keep your spending in view.</p>
        </div>
        <Field
          id="budgets-month"
          label="Budget month"
          type="month"
          min="1900-01"
          max="2199-12"
          value={month}
          onChange={(event) => {
            if (event.target.value) {
              setMonth(event.target.value);
              setNotice("");
            }
          }}
        />
      </header>
      <p className="budget-explanation">
        Budgets use net spending: expenses minus refunds dated in this month.
        Category limits do not add to or change the overall limit.
      </p>
      {notice && <StatusMessage>{notice}</StatusMessage>}
      {pending && (
        <p role="status" className="loading-status">
          Loading budgets…
        </p>
      )}
      {error && (
        <StatusMessage error>
          {error}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </StatusMessage>
      )}
      {data && (
        <div className="budget-list">
          {data.items
            .filter(
              (budget) =>
                !budget.archived ||
                budget.limitMinor !== null ||
                budget.spentMinor !== 0,
            )
            .map((budget) => {
              const remaining =
                budget.limitMinor === null
                  ? null
                  : budget.limitMinor - budget.spentMinor;
              const percent =
                budget.limitMinor === null
                  ? 0
                  : budget.limitMinor === 0
                    ? budget.spentMinor > 0
                      ? 100
                      : 0
                    : Math.max(
                        0,
                        Math.min(
                          100,
                          (budget.spentMinor / budget.limitMinor) * 100,
                        ),
                      );
              return (
                <article
                  key={budget.scope}
                  className={`budget-row${remaining !== null && remaining < 0 ? " over-budget" : ""}`}
                  aria-label={budget.name}
                >
                  <div className="budget-row-heading">
                    <h3>
                      {budget.name}
                      {budget.archived ? " (archived)" : ""}
                    </h3>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditing(budget)}
                    >
                      {budget.limitMinor === null ? "Set" : "Edit"}{" "}
                      {budget.name === "Overall budget"
                        ? "overall"
                        : budget.name}{" "}
                      budget
                    </button>
                  </div>
                  <p>
                    Net spending{" "}
                    <strong>{money(budget.spentMinor, currency)}</strong>
                    {budget.limitMinor === null
                      ? " · No limit set"
                      : ` of ${money(budget.limitMinor, currency)}`}
                  </p>
                  {remaining !== null && (
                    <>
                      <div
                        className="budget-ruler"
                        role="progressbar"
                        aria-label={`${budget.name} limit used`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(percent)}
                        aria-valuetext={`${money(budget.spentMinor, currency)} net spending of ${money(budget.limitMinor!, currency)} limit`}
                      >
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <p className="budget-remaining">
                        {money(Math.abs(remaining), currency)}{" "}
                        {remaining < 0 ? "over budget" : "remaining"}
                      </p>
                    </>
                  )}
                </article>
              );
            })}
        </div>
      )}
      {editing && (
        <BudgetEditor
          budget={editing}
          month={month}
          workspace={workspace}
          onClose={() => {
            setEditing(null);
            setAttempt((value) => value + 1);
          }}
          onSaved={() => {
            setEditing(null);
            setNotice("Budget saved.");
            onSaved();
          }}
        />
      )}
    </section>
  );
}
