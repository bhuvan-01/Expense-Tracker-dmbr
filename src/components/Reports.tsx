import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { downloadCsv } from "../lib/download";
import { dateLabel, money, todayIn, type Workspace } from "../lib/ledger";
import { monthLabel, type MonthSummary } from "../lib/summary";
import { Field } from "./Field";
import { StatusMessage } from "./StatusMessage";
export function Reports({
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
    [pending, setPending] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setPending(true);
    setError("");
    setData(null);
    setNotice("");
    setExportError("");
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
            err instanceof Error ? err.message : "Unable to load the report.",
          );
          setPending(false);
        }
      });
    return () => abort.abort();
  }, [month, revision, attempt]);
  async function exportMonth() {
    if (!data || exporting) return;
    setExporting(true);
    setExportError("");
    setNotice("");
    try {
      await downloadCsv("all", { from: data.from, to: data.to });
      setNotice(`CSV download started for ${monthLabel(data.month)}.`);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Unable to export this month.",
      );
    } finally {
      setExporting(false);
    }
  }
  const currency = workspace.preferences.currency!;
  return (
    <section
      className="history-panel overview-panel"
      aria-labelledby="reports-title"
    >
      <header className="period-heading">
        <div>
          <h2 id="reports-title">Monthly report</h2>
          <p>Review every recorded day and take your data with you.</p>
        </div>
        <Field
          id="report-month"
          label="Report month"
          type="month"
          min="1900-01"
          max="2199-12"
          value={month}
          disabled={exporting}
          onChange={(event) => {
            if (event.target.value) setMonth(event.target.value);
          }}
        />
      </header>
      {pending && (
        <p role="status" className="loading-status">
          Loading report…
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
        <>
          <div className="report-actions">
            <div>
              <h3>{monthLabel(data.month)}</h3>
              <p>
                {data.totals.count} recorded{" "}
                {data.totals.count === 1 ? "entry" : "entries"} · {currency}
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={exporting || data.totals.count === 0}
              onClick={() => void exportMonth()}
            >
              {exporting ? "Preparing CSV…" : "Download monthly CSV"}
            </button>
          </div>
          <p className="budget-explanation">
            Net spending = expenses − refunds. Income minus net spending is
            calculated from recorded entries only. Downloads contain expenses,
            income and refunds with their types and linked purchase IDs. Up to
            10,000 entries per export.
          </p>
          {exportError && (
            <StatusMessage error>
              {exportError}{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => void exportMonth()}
                disabled={exporting}
              >
                Retry export
              </button>
            </StatusMessage>
          )}
          {notice && <StatusMessage>{notice}</StatusMessage>}
          {data.days.length ? (
            <>
              <p className="table-scroll-hint">
                Scroll the table horizontally to see all columns on a small
                screen. Keyboard users can focus the table region and use arrow
                keys.
              </p>
              <div
                className="report-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Daily report table"
              >
                <table className="report-table">
                  <caption className="sr-only">
                    Daily financial report for {monthLabel(data.month)} in{" "}
                    {currency}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Income</th>
                      <th scope="col">Expenses</th>
                      <th scope="col">Refunds</th>
                      <th scope="col">Net spending</th>
                      <th scope="col">Income minus net spending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((day) => (
                      <tr key={day.date}>
                        <th scope="row">
                          <time dateTime={day.date}>{dateLabel(day.date)}</time>
                        </th>
                        <td>{money(day.incomeMinor, currency)}</td>
                        <td>{money(day.expensesMinor, currency)}</td>
                        <td>{money(day.refundsMinor, currency)}</td>
                        <td>{money(day.netMinor, currency)}</td>
                        <td>{money(day.differenceMinor, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Month total</th>
                      <td>{money(data.totals.incomeMinor, currency)}</td>
                      <td>{money(data.totals.expensesMinor, currency)}</td>
                      <td>{money(data.totals.refundsMinor, currency)}</td>
                      <td>{money(data.totals.netMinor, currency)}</td>
                      <td>{money(data.totals.differenceMinor, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <p className="empty-summary">
              No entries recorded in this month. Select another month or record
              your first entry.
            </p>
          )}
        </>
      )}
    </section>
  );
}
