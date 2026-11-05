import { useEffect, useRef, type ReactNode } from "react";

export function Dialog({
  open,
  titleId,
  descriptionId,
  className = "",
  onRequestClose,
  children,
}: {
  open: boolean;
  titleId: string;
  descriptionId?: string;
  className?: string;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open) {
      if (dialog?.open) dialog.close();
      return;
    }
    const previousFocus = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      requestAnimationFrame(() => {
        if (
          previousFocus instanceof HTMLElement &&
          previousFocus.isConnected &&
          !previousFocus.closest("dialog:not([open])")
        )
          previousFocus.focus();
      });
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`app-dialog ${className}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
    >
      {children}
    </dialog>
  );
}
