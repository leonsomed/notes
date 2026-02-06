import { TextInput } from "../TextInput";
import { Dialog } from "./Dialog";

interface RestoreDialogProps {
  isOpen: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RestoreDialog({
  isOpen,
  password,
  onPasswordChange,
  error,
  isBusy,
  onCancel,
  onConfirm,
}: RestoreDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog titleId="restore-dialog-title" size="sm" zIndex={50}>
      <h2
        id="restore-dialog-title"
        className="text-base font-semibold text-slate-100"
      >
        Unlock vault export
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        Enter the password used to encrypt this vault export.
      </p>
      <label
        htmlFor="restore-password"
        className="mt-4 block text-xs text-slate-400"
      >
        Vault password
      </label>
      <TextInput
        id="restore-password"
        type="password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        className="mt-2 w-full px-3 py-2 text-sm text-slate-200"
      />
      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-200 transition hover:border-slate-400"
          disabled={isBusy}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full border border-indigo-500 bg-indigo-500/10 px-4 py-1 text-xs text-indigo-100 transition hover:bg-indigo-500/20"
          disabled={isBusy}
        >
          {isBusy ? "Restoring..." : "Restore"}
        </button>
      </div>
    </Dialog>
  );
}
