import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, todayIn, type Workspace } from "../lib/ledger";
import { monthLabel, type MonthSummary } from "../lib/summary";
import { Field } from "./Field";
import { StatusMessage } from "./StatusMessage";
export function MonthlyOverview({
  workspace,
  revision,
}: {
  workspace: Workspace;
  revision: number;
}) {
  const [month, setMonth] = useState(() =>
    todayIn(workspace.preferences.timezone!).slice(0, 7),
  );
  const [data, setData] = useState<MonthSummary | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setPending(true);
    setError("");
    setData(null);
    void api<MonthSummary>(`/summary?month=${encodeURIComponent(month)}`, {
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
            err instanceof Error ? err.message : "Unable to load the overview.",
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
      aria-labelledby="overview-title"
      aria-busy={pending}
    >
      <header className="period-heading">
        <div>
          <h2 id="overview-title">Monthly overview</h2>
          <p>See how money received compares with your spending.</p>
        </div>
        <Field
          id="overview-month"
          label="Overview month"
          type="month"
          min="1900-01"
          max="2199-12"
          value={month}
          onChange={(event) => {
            if (event.target.value) setMonth(event.target.value);
          }}
        />
      </header>
      {pending && (
        <p role="status" className="loading-status">
          Loading your month…
        </p>
      )}
      {error && (
        <StatusMessage error>
          {error}{" "}
          <button
            className="text-button"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </StatusMessage>
      )}
      {data && (
        <>
          <h3 className="period-label">{monthLabel(data.month)}</h3>
          <dl className="summary-grid">
            {(
              [
                ["Income", data.totals.incomeMinor],
                ["Expenses", data.totals.expensesMinor],
                ["Refunds", data.totals.refundsMinor],
                ["Net spending", data.totals.netMinor],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{money(value, currency)}</dd>
              </div>
            ))}
          </dl>
          <div className="monthly-difference">
            <span>Income minus net spending</span>
            <strong>{money(data.totals.differenceMinor, currency)}</strong>
            <p>
              Calculated from recorded entries only. This is not a bank account
              balance.
            </p>
          </div>
          <p className="comparison-copy">
            Previous month net spending:{" "}
            <strong>{money(data.previous.netMinor, currency)}</strong>.{" "}
            {data.totals.netMinor === data.previous.netMinor
              ? "No change."
              : `${money(Math.abs(data.totals.netMinor - data.previous.netMinor), currency)} ${data.totals.netMinor > data.previous.netMinor ? "more" : "less"} this month.`}
          </p>
          {data.totals.count === 0 && (
            <p className="empty-summary">
              No entries recorded in this month. Add an expense or income entry
              to start building your picture.
            </p>
          )}
          <div className="summary-categories">
            <h3>Spending by category</h3>
            <p>
              Net spending = expenses − refunds recorded during this month. An
              older purchase refunded this month can make a category negative.
            </p>
            {data.categories.length ? (
              <div
                className="report-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Category spending table"
              >
                <table className="report-table">
                  <caption className="sr-only">
                    Monthly expenses and refunds by category
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Expenses</th>
                      <th scope="col">Refunds</th>
                      <th scope="col">Net spending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((category) => (
                      <tr key={category.id}>
                        <th scope="row">{category.name}</th>
                        <td>{money(category.expensesMinor, currency)}</td>
                        <td>{money(category.refundsMinor, currency)}</td>
                        <td>{money(category.netMinor, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-summary">
                No spending or refunds in this month.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
