import { Dialog } from "../base/Dialog";
import { Button } from "../base/Button";

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
        <Button onClick={onCancel} size="xsWide" autoFocus>
          Cancel
        </Button>
        <Button variant="soft" tone="danger" onClick={onConfirm} size="xsWide">
          Delete
        </Button>
      </div>
    </Dialog>
  );
}
