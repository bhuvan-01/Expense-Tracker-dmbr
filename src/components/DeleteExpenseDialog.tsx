import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { money, type Expense } from "../lib/ledger";
import { Dialog } from "./Dialog";
import { StatusMessage } from "./StatusMessage";

export function DeleteExpenseDialog({
  expense,
  onClose,
  onDeleted,
}: {
  expense: Expense;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await api(`/expenses/${expense.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: expense.version }),
      });
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        onDeleted();
        return;
      }
      setError(
        err instanceof Error ? err.message : "Unable to delete this expense.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      titleId="delete-title"
      descriptionId="delete-description"
      className="confirm-dialog"
      onRequestClose={() => {
        if (!pending) onClose();
      }}
    >
      <h2 id="delete-title">Delete this expense?</h2>
      <p id="delete-description">
        <strong>{expense.merchant || expense.categoryName}</strong> ·{" "}
        {money(expense.amountMinor, expense.currency)} will be permanently
        removed from your history. This cannot be undone.
      </p>
      {error && <StatusMessage error>{error}</StatusMessage>}
      <div className="dialog-actions">
        <button
          type="button"
          autoFocus
          className="secondary-button"
          onClick={onClose}
          disabled={pending}
        >
          Keep expense
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={remove}
          disabled={pending}
        >
          {pending && (
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
          )}
          {pending ? "Deleting…" : "Delete expense"}
        </button>
      </div>
    </Dialog>
  );
}
