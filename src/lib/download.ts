import { ApiError } from "./api";
export async function downloadCsv(
  kind: string,
  filters: Record<string, unknown>,
) {
  let response: Response;
  try {
    response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, filters }),
    });
  } catch {
    throw new ApiError(
      0,
      "Unable to connect. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to export. Please try again.");
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expense-tracker-${kind}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
