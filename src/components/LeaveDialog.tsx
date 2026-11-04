import { useEffect, useRef } from "react";

export function LeaveDialog({
  destination,
  onCancel,
  onDiscard,
}: {
  destination: string | null;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (destination) ref.current?.showModal();
    else ref.current?.close();
  }, [destination]);
  return (
    <dialog
      ref={ref}
      className="leave-dialog"
      aria-labelledby="leave-title"
      aria-describedby="leave-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
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
    </dialog>
  );
}
