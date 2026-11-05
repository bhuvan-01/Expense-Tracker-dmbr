import { Dialog } from "./Dialog";

export function LeaveDialog({
  destination,
  onCancel,
  onDiscard,
}: {
  destination: string | null;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog
      open={Boolean(destination)}
      className="leave-dialog"
      titleId="leave-title"
      descriptionId="leave-description"
      onRequestClose={onCancel}
    >
      <h2 id="leave-title">Leave this form?</h2>
      <p id="leave-description">The details you've entered will be cleared.</p>
      <div className="dialog-actions">
        <button
          type="button"
          className="secondary-button"
          autoFocus
          onClick={onCancel}
        >
          Keep editing
        </button>
        <button type="button" className="primary-button" onClick={onDiscard}>
          Discard changes
        </button>
      </div>
    </Dialog>
  );
}
