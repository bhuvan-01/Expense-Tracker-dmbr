import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle,
  LogOut,
  Plus,
  ReceiptText,
  ShieldCheck,
  Settings2,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";
import { entryLabels, type EntryKind, type MoneyEntry } from "../lib/entries";
import { Reports } from "../components/Reports";
import { Budgets } from "../components/Budgets";
import { MonthlyOverview } from "../components/MonthlyOverview";
import { CategoryManager } from "../components/CategoryManager";
import type { Category, Expense, Workspace } from "../lib/ledger";
import { WorkspaceSetup } from "../components/WorkspaceSetup";
import { ExpenseHistory } from "../components/ExpenseHistory";
import { ExpenseForm } from "../components/ExpenseForm";
import { DeleteExpenseDialog } from "../components/DeleteExpenseDialog";
import { StatusMessage } from "../components/StatusMessage";
import { Dialog } from "../components/Dialog";
import { LeaveDialog } from "../components/LeaveDialog";

type User = { id: string; name: string; email: string };
export function WorkspacePage() {
  const [user, setUser] = useState<User | null>(null),
    [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false),
    [attempt, setAttempt] = useState(0),
    [revision, setRevision] = useState(0);
  const [view, setView] = useState<
    EntryKind | "overview" | "budgets" | "reports"
  >("expense");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editor, setEditor] = useState<{
      expense: MoneyEntry | null;
      kind: EntryKind;
      refundOf?: Expense;
    } | null>(null),
    [deleting, setDeleting] = useState<{
      expense: Expense;
      kind: EntryKind;
    } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [settings, setSettings] = useState(false),
    [settingsDirty, setSettingsDirty] = useState(false),
    [settingsPending, setSettingsPending] = useState(false),
    [discardSettings, setDiscardSettings] = useState(false);
  const closeSettings = () => {
    if (settingsPending) return;
    if (settingsDirty) setDiscardSettings(true);
    else setSettings(false);
  };
  useEffect(() => {
    document.title = "Your expenses · Expense Tracker";
    const abort = new AbortController();
    async function load() {
      try {
        setError("");
        const response = await fetch("/api/me", { signal: abort.signal });
        if (response.status === 401) {
          window.location.replace("/sign-in");
          return;
        }
        if (!response.ok)
          throw new Error("Unable to load your account. Please try again.");
        const data = (await response.json()) as { user: User };
        const loaded = await api<Workspace>("/workspace", {
          signal: abort.signal,
        });
        if (!abort.signal.aborted) {
          setUser(data.user);
          setWorkspace(loaded);
        }
      } catch (err) {
        if (!abort.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your workspace. Please try again.",
          );
      }
    }
    void load();
    return () => abort.abort();
  }, [attempt]);
  async function signOut() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Unavailable");
      window.location.replace("/sign-in");
    } catch {
      setError("Unable to sign out. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  const add = () => {
    setNotice("");
    setEditor({
      expense: null,
      kind: view === "income" ? "income" : "expense",
    });
  };
  function categoryAdded(category: Category) {
    setRevision((value) => value + 1);
    setWorkspace((current) =>
      current
        ? {
            ...current,
            categories: [
              ...current.categories.filter((item) => item.id !== category.id),
              category,
            ].sort((a, b) => a.name.localeCompare(b.name)),
          }
        : current,
    );
  }
  function saved() {
    const editing = Boolean(editor?.expense);
    setEditor(null);
    setRevision((value) => value + 1);
    setNotice(
      editing
        ? "Changes saved."
        : editor?.kind === "income"
          ? "Income added."
          : editor?.kind === "refund"
            ? "Refund recorded."
            : "Expense added.",
    );
    setWorkspace((current) =>
      current
        ? {
            ...current,
            preferences: { ...current.preferences, currencyLocked: 1 },
          }
        : current,
    );
    requestAnimationFrame(() => addButton.current?.focus());
  }
  return (
    <div className="workspace ledger-workspace">
      <header className="workspace-header">
        <Brand />
        <div className="workspace-account">
          {user && <span className="account-email">{user.email}</span>}
          <button
            type="button"
            className="secondary-button"
            onClick={signOut}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : (
              <LogOut size={16} aria-hidden="true" />
            )}
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <main className="ledger-main" id="main-content">
        {error && (
          <StatusMessage error>
            {error}{" "}
            {!workspace && (
              <button
                type="button"
                className="text-button"
                onClick={() => setAttempt(attempt + 1)}
              >
                Try again
              </button>
            )}
          </StatusMessage>
        )}
        {!workspace && !error && (
          <p role="status" className="loading-status">
            <LoaderCircle className="spin" aria-hidden="true" /> Loading your
            workspace…
          </p>
        )}
        {user && workspace && (
          <>
            <div className="ledger-heading">
              <div>
                <p className="ledger-eyebrow">
                  <ReceiptText size={15} aria-hidden="true" /> YOUR PERSONAL
                  LEDGER
                </p>
                <h1>
                  Welcome, {user.name.split(/\s+/)[0]}
                  <span className="brand-dot">.</span>
                </h1>
                <p className="ledger-subtitle">
                  A little attention to your everyday spending.
                </p>
              </div>
              {workspace.preferences.currency && (
                <button
                  ref={addButton}
                  type="button"
                  className="primary-button add-expense"
                  onClick={add}
                >
                  <Plus size={18} aria-hidden="true" />{" "}
                  {view === "income" ? "Add income" : "Add expense"}
                </button>
              )}
            </div>
            {notice && <StatusMessage>{notice}</StatusMessage>}
            {!workspace.preferences.currency ? (
              <WorkspaceSetup
                onSaved={(loaded) => {
                  setWorkspace(loaded);
                  setNotice("Workspace ready. Add your first expense.");
                }}
              />
            ) : (
              <>
                <div className="ledger-context">
                  <span>
                    <ShieldCheck size={15} aria-hidden="true" /> Only your
                    entries appear here
                  </span>
                  <span>
                    {workspace.preferences.currency}{" "}
                    <span aria-hidden="true">·</span>{" "}
                    {workspace.preferences.timezone?.replaceAll("_", " ")}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Workspace settings"
                      title="Workspace settings"
                      onClick={() => {
                        setSettingsDirty(false);
                        setSettingsPending(false);
                        setSettings(true);
                      }}
                    >
                      <Settings2 size={16} aria-hidden="true" />
                    </button>
                  </span>
                </div>
                <nav className="ledger-navigation" aria-label="Your ledger">
                  <button
                    type="button"
                    aria-current={view === "overview" ? "page" : undefined}
                    onClick={() => {
                      setView("overview");
                      setNotice("");
                    }}
                  >
                    Overview
                  </button>
                  {(["expense", "income", "refund"] as const).map((kind) => (
                    <button
                      type="button"
                      key={kind}
                      aria-current={view === kind ? "page" : undefined}
                      onClick={() => {
                        setView(kind);
                        setNotice("");
                        window.history.replaceState({}, "", "/app");
                      }}
                    >
                      {kind === "expense"
                        ? "Expenses"
                        : kind === "income"
                          ? "Income"
                          : "Refunds"}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-current={view === "budgets" ? "page" : undefined}
                    onClick={() => {
                      setView("budgets");
                      setNotice("");
                    }}
                  >
                    Budgets
                  </button>
                  <button
                    type="button"
                    aria-current={view === "reports" ? "page" : undefined}
                    onClick={() => {
                      setView("reports");
                      setNotice("");
                    }}
                  >
                    Reports
                  </button>
                  <button type="button" onClick={() => setCategoriesOpen(true)}>
                    Manage categories
                  </button>
                </nav>
                {view === "reports" ? (
                  <Reports workspace={workspace} revision={revision} />
                ) : view === "budgets" ? (
                  <Budgets
                    workspace={workspace}
                    revision={revision}
                    onSaved={() => {
                      setRevision((value) => value + 1);
                      setWorkspace((current) =>
                        current
                          ? {
                              ...current,
                              preferences: {
                                ...current.preferences,
                                currencyLocked: 1,
                              },
                            }
                          : current,
                      );
                    }}
                  />
                ) : view === "overview" ? (
                  <MonthlyOverview workspace={workspace} revision={revision} />
                ) : (
                  <ExpenseHistory
                    key={view}
                    kind={view}
                    onRefund={(expense) =>
                      setEditor({
                        expense: null,
                        kind: "refund",
                        refundOf: expense,
                      })
                    }
                    workspace={workspace}
                    revision={revision}
                    onAdd={view === "refund" ? () => setView("expense") : add}
                    onEdit={(expense) => {
                      setNotice("");
                      setEditor({ expense, kind: view });
                    }}
                    onDelete={(expense) => {
                      setNotice("");
                      setDeleting({ expense, kind: view });
                    }}
                  />
                )}
                <p className="ledger-footnote">
                  Expenses show gross spending. Refunds stay linked to purchases
                  and reduce net spending in their recorded period.
                </p>
              </>
            )}
          </>
        )}
      </main>
      {editor && workspace && (
        <ExpenseForm
          expense={editor.expense}
          kind={editor.kind}
          refundOf={editor.refundOf}
          workspace={workspace}
          onClose={() => {
            setEditor(null);
            setRevision((value) => value + 1);
          }}
          onSaved={saved}
          onCategory={categoryAdded}
        />
      )}
      {deleting && (
        <DeleteExpenseDialog
          expense={deleting.expense}
          kind={deleting.kind}
          onClose={() => {
            setDeleting(null);
            setRevision((value) => value + 1);
          }}
          onDeleted={() => {
            setDeleting(null);
            setRevision((value) => value + 1);
            setNotice(
              `${entryLabels[deleting.kind].singular === "expense" ? "Expense" : deleting.kind === "income" ? "Income" : "Refund"} deleted.`,
            );
            requestAnimationFrame(() => addButton.current?.focus());
          }}
        />
      )}
      {categoriesOpen && workspace && (
        <CategoryManager
          categories={workspace.categories}
          onChanged={categoryAdded}
          onClose={() => {
            setCategoriesOpen(false);
            setAttempt((value) => value + 1);
          }}
        />
      )}
      {settings && workspace && (
        <>
          <Dialog
            open
            titleId="setup-title"
            className="settings-dialog"
            onRequestClose={closeSettings}
          >
            <WorkspaceSetup
              preferences={workspace.preferences}
              onDirtyChange={setSettingsDirty}
              onPendingChange={setSettingsPending}
              onSaved={(loaded) => {
                setWorkspace(loaded);
                setSettings(false);
                setRevision((value) => value + 1);
                setNotice("Workspace settings saved.");
              }}
            />
            <div className="dialog-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={closeSettings}
                disabled={settingsPending}
              >
                Close settings
              </button>
            </div>
          </Dialog>
          <LeaveDialog
            destination={discardSettings ? "settings" : null}
            onCancel={() => setDiscardSettings(false)}
            onDiscard={() => {
              setDiscardSettings(false);
              setSettings(false);
            }}
          />
        </>
      )}
    </div>
  );
}
