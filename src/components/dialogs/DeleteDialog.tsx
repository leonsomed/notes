import { Dialog } from "../base/Dialog";

interface DeleteDialogProps {
  isOpen: boolean;
  documentTitle?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteDialog({
  isOpen,
  documentTitle,
  onCancel,
  onConfirm,
}: DeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog titleId="delete-dialog-title" size="sm" zIndex={50}>
      <h2
        id="delete-dialog-title"
        className="text-base font-semibold text-slate-100"
      >
        Delete document "{documentTitle ?? ""}"?
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        This action cannot be undone.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-200 transition hover:border-slate-400"
          autoFocus
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full border border-rose-500 bg-rose-500/10 px-4 py-1 text-xs text-rose-200 transition hover:bg-rose-500/20"
        >
          Delete
        </button>
      </div>
    </Dialog>
  );
}
