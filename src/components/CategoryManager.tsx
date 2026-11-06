import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Category } from "../lib/ledger";
import { Dialog } from "./Dialog";
import { LeaveDialog } from "./LeaveDialog";
import { Field } from "./Field";
import { SelectField } from "./SelectField";
import { StatusMessage } from "./StatusMessage";

export function CategoryManager({
  categories,
  onChanged,
  onClose,
}: {
  categories: Category[];
  onChanged: (category: Category) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(categories[0]?.id || "");
  const current = categories.find((item) => item.id === selected);
  const [name, setName] = useState(current?.name || "");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [discard, setDiscard] = useState(false),
    [confirm, setConfirm] = useState(false);
  const dirty = name !== (current?.name || "");
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function close() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function save(archive?: boolean) {
    if (!current || pending) return;
    if (!name.trim() || name.trim().length > 50) {
      setError("Use a category name of 1–50 characters.");
      document.getElementById("category-name")?.focus();
      return;
    }
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Category>(`/categories/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          version: current.version,
          ...(archive === undefined ? {} : { archived: archive }),
        }),
      });
      onChanged(result);
      setName(result.name);
      setConfirm(false);
      setNotice(
        archive === undefined
          ? "Category renamed. Existing history uses the new name."
          : archive
            ? "Category archived. Existing entries are preserved."
            : "Category restored.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save this category.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Dialog
        open
        titleId="categories-title"
        className="settings-dialog"
        onRequestClose={close}
      >
        <div className="category-manager">
          <h2 id="categories-title">Manage categories</h2>
          <p>
            Rename a category across your history, or archive it to hide it from
            new expenses. You can restore it later.
          </p>
          {error && <StatusMessage error>{error}</StatusMessage>}
          {notice && <StatusMessage>{notice}</StatusMessage>}
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <SelectField
              id="managed-category"
              label="Choose category"
              value={selected}
              disabled={pending || dirty}
              onChange={(event) => {
                setSelected(event.target.value);
                setName(
                  categories.find((item) => item.id === event.target.value)
                    ?.name || "",
                );
                setError("");
                setNotice("");
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.archived ? " (archived)" : ""}
                </option>
              ))}
            </SelectField>
            <Field
              id="category-name"
              label="Category name"
              value={name}
              maxLength={50}
              required
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={pending || dirty || !current}
                onClick={() => setConfirm(true)}
              >
                {current?.archived ? "Restore category" : "Archive category"}
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={pending || !dirty || !name.trim()}
              >
                {pending ? "Saving…" : "Save name"}
              </button>
            </div>
            {dirty && (
              <p className="field-help">
                Save the name before choosing another category.
              </p>
            )}
          </form>
        </div>
        <footer className="dialog-footer">
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={close}
          >
            Close categories
          </button>
        </footer>
      </Dialog>
      {confirm && (
        <Dialog
          open
          titleId="archive-title"
          className="confirm-dialog"
          onRequestClose={() => {
            if (!pending) setConfirm(false);
          }}
        >
          <h2 id="archive-title">
            {current?.archived ? "Restore" : "Archive"} {current?.name}?
          </h2>
          <p>
            {current?.archived
              ? "This category will appear when adding expenses again."
              : "Existing entries and reports will keep this category. It will be hidden when adding new expenses."}
          </p>
          {error && <StatusMessage error>{error}</StatusMessage>}
          <div className="dialog-actions">
            <button
              type="button"
              autoFocus
              className="secondary-button"
              disabled={pending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={pending}
              onClick={() => void save(!current?.archived)}
            >
              {pending
                ? "Saving…"
                : current?.archived
                  ? "Restore category"
                  : "Archive category"}
            </button>
          </div>
        </Dialog>
      )}
      <LeaveDialog
        destination={discard ? "categories" : null}
        onCancel={() => setDiscard(false)}
        onDiscard={onClose}
      />
    </>
  );
}
