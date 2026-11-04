import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  LoaderCircle,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { authClient } from "../lib/auth-client";

type User = { id: string; name: string; email: string };

export function WorkspacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    document.title = "Your workspace · Expense Tracker";
    const abort = new AbortController();
    async function load() {
      try {
        setError("");
        const response = await fetch("/api/me", { signal: abort.signal });
        if (response.status === 401) {
          window.location.replace("/sign-in");
          return;
        }
        if (!response.ok) throw new Error("Unavailable");
        const data = (await response.json()) as { user: User };
        setUser(data.user);
      } catch {
        if (!abort.signal.aborted)
          setError("Unable to load your workspace. Please try again.");
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
  return (
    <div className="workspace">
      <header className="workspace-header">
        <Brand />
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
          )}{" "}
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </header>
      <main className="workspace-main" id="main-content">
        {error && (
          <div className="workspace-error" role="alert">
            {error}{" "}
            {!user && (
              <button
                type="button"
                className="text-button"
                onClick={() => setAttempt(attempt + 1)}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {!user && !error && (
          <p role="status" className="loading-status">
            <LoaderCircle className="spin" aria-hidden="true" /> Loading your
            workspace…
          </p>
        )}
        {user && (
          <>
            <div className="ready-badge">
              <Check size={14} aria-hidden="true" /> ACCOUNT READY
            </div>
            <h1>
              Welcome, {user.name.split(/\s+/)[0]}
              <span className="brand-dot">.</span>
            </h1>
            <p className="workspace-intro">A clearer picture starts here.</p>
            <section className="welcome-card" aria-labelledby="workspace-title">
              <span className="welcome-icon">
                <CircleCheck size={28} aria-hidden="true" />
              </span>
              <h2 id="workspace-title">You're in. Your space is ready.</h2>
              <p>
                You're signed in as <strong>{user.email}</strong>. Your account
                is saved, and you can return whenever you're ready.
              </p>
              <div className="milestone">
                <span>
                  <ShieldCheck size={20} aria-hidden="true" /> Signup & sign-in
                </span>
                <span className="complete-label">
                  Complete <Check size={14} aria-hidden="true" />
                </span>
              </div>
              <div className="next-milestone">
                <span className="next-icon">
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>Next: your first expense</strong>
                  <small>
                    Expense entry, categories, and your monthly overview are
                    coming in the next milestones.
                  </small>
                </span>
              </div>
            </section>
            <p className="workspace-footnote">
              Built one useful step at a time.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
