import { Dialog } from "../base/Dialog";
import { Button } from "../base/Button";
import { TextInput } from "../base/TextInput";

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
        <Button onClick={onCancel} disabled={isBusy} size="xsWide">
          Cancel
        </Button>
        <Button
          variant="soft"
          tone="primary"
          onClick={onConfirm}
          disabled={isBusy}
          size="xsWide"
        >
          {isBusy ? "Restoring..." : "Restore"}
        </Button>
      </div>
    </Dialog>
  );
}
