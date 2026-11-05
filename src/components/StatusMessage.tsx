import { AlertCircle, CheckCircle2 } from "lucide-react";

export function StatusMessage({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={error ? "ledger-message error" : "ledger-message success"}
      role={error ? "alert" : "status"}
    >
      {error ? (
        <AlertCircle size={18} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={18} aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  );
}
