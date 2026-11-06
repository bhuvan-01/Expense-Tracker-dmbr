import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Globe2, LoaderCircle } from "lucide-react";
import {
  CURRENCIES,
  type Currency,
  type Preferences,
  type Workspace,
} from "../lib/ledger";
import { api } from "../lib/api";
import { SelectField } from "./SelectField";
import { StatusMessage } from "./StatusMessage";

export function WorkspaceSetup({
  onSaved,
  preferences,
  onDirtyChange,
  onPendingChange,
}: {
  onSaved: (workspace: Workspace) => void;
  preferences?: Preferences;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const initialZone =
    preferences?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";
  const [currency, setCurrency] = useState<string>(preferences?.currency || "");
  const [timezone, setTimezone] = useState(initialZone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [currencyError, setCurrencyError] = useState("");
  const dirty =
    currency !== (preferences?.currency || "") || timezone !== initialZone;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const zones = [
    ...new Set(["UTC", timezone, ...Intl.supportedValuesOf("timeZone")]),
  ].sort();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!currency) {
      setCurrencyError("Choose the currency you use for everyday spending.");
      document.getElementById("setup-currency")?.focus();
      return;
    }
    setPending(true);
    setError("");
    try {
      onSaved(
        await api<Workspace>("/workspace", {
          method: "PUT",
          body: JSON.stringify({ currency: currency as Currency, timezone }),
        }),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save your workspace.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="setup-card" aria-labelledby="setup-title">
      <span className="setup-icon">
        <Globe2 size={25} aria-hidden="true" />
      </span>
      <p className="form-step">MAKE IT YOURS</p>
      <h2 id="setup-title">
        {preferences
          ? "Workspace settings"
          : "A home for your everyday spending."}
      </h2>
      <p>
        {preferences
          ? "Keep your workspace in step with your everyday."
          : "Choose your currency and timezone. Then you're ready to record your first entry or budget."}
      </p>
      <form noValidate onSubmit={submit} aria-busy={pending}>
        {error && <StatusMessage error>{error}</StatusMessage>}
        <SelectField
          id="setup-currency"
          label="Workspace currency"
          value={currency}
          onChange={(event) => {
            setCurrency(event.target.value);
            setCurrencyError("");
          }}
          error={currencyError}
          disabled={pending || Boolean(preferences?.currencyLocked)}
          hint={
            preferences?.currencyLocked
              ? "Your currency is fixed because you have recorded an expense."
              : "This is fixed once you save your first entry or budget."
          }
          required
        >
          <option value="">Choose your currency</option>
          {Object.entries(CURRENCIES).map(([code, info]) => (
            <option key={code} value={code}>
              {code} — {info.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="setup-timezone"
          label="Your timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          disabled={pending}
          hint="Used to determine today's date. Expense dates stay as you enter them."
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </SelectField>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : preferences
              ? "Save settings"
              : "Start tracking"}
          {pending ? (
            <LoaderCircle size={18} className="spin" aria-hidden="true" />
          ) : (
            <ArrowRight size={18} aria-hidden="true" />
          )}
        </button>
      </form>
    </section>
  );
}
