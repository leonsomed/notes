import { ActionButton } from "../base/ActionButton";
import { Checkbox } from "../base/Checkbox";
import { IconButton } from "../base/IconButton";
import { TextInput } from "../base/TextInput";
import { Dialog } from "../base/Dialog";
import { DEFAULT_INACTIVITY_MINUTES } from "../../hooks/usePersistedPreferences";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onRestore: () => void;
  uploadUrl: string;
  onUploadUrlChange: (value: string) => void;
  isUploadEnabled: boolean;
  onUploadEnabledChange: (value: boolean) => void;
  isUploadUrlValid: boolean;
  hasUploadChanges: boolean;
  isInactivityEnabled: boolean;
  onInactivityEnabledChange: (value: boolean) => void;
  inactivityMinutes: number;
  onInactivityMinutesChange: (value: number) => void;
}

export function SettingsDialog({
  isOpen,
  onClose,
  onExport,
  onRestore,
  uploadUrl,
  onUploadUrlChange,
  isUploadEnabled,
  onUploadEnabledChange,
  isUploadUrlValid,
  hasUploadChanges,
  isInactivityEnabled,
  onInactivityEnabledChange,
  inactivityMinutes,
  onInactivityMinutesChange,
}: SettingsDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog titleId="settings-dialog-title" size="md" zIndex={40}>
      <div className="flex items-center justify-between">
        <h2
          id="settings-dialog-title"
          className="text-base font-semibold text-slate-100"
        >
          Settings
        </h2>
        <IconButton
          onClick={onClose}
          className="px-2 py-1 text-sm text-slate-400 hover:text-slate-200"
          ariaLabel="Close settings"
        />
      </div>
      <p className="mt-2 text-sm text-slate-300">
        Manage your data exports and restores.
      </p>
      <div className="mt-4 grid gap-3">
        <ActionButton
          label="Export notes"
          description="Download a JSON backup"
          onClick={onExport}
        />
        <ActionButton
          label="Restore notes"
          description="Replace with a backup"
          onClick={onRestore}
        />
      </div>
      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-100">
              Background upload
            </p>
            <p className="text-xs text-slate-400">
              Upload changes when you leave the tab or window.
            </p>
          </div>
          <Checkbox
            checked={isUploadEnabled}
            disabled={!isUploadUrlValid}
            onChange={onUploadEnabledChange}
          />
        </div>
        <div className="mt-3">
          <label className="text-xs text-slate-400" htmlFor="upload-url">
            Server URL
          </label>
          <TextInput
            id="upload-url"
            value={uploadUrl}
            onChange={(event) => onUploadUrlChange(event.target.value)}
            placeholder="https://example.com/api/notes/export"
            className="mt-2 w-full px-3 py-2 text-xs text-slate-200"
          />
          {!isUploadUrlValid ? (
            <p className="mt-2 text-xs text-slate-500">
              Enter a valid URL to enable uploads.
            </p>
          ) : null}
          {isUploadEnabled && hasUploadChanges ? (
            <p className="mt-2 text-xs text-slate-500">
              Changes will upload when you leave the tab or window.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-100">
              Auto-lock on inactivity
            </p>
            <p className="text-xs text-slate-400">
              Reloads the page after inactivity to re-lock the vault.
            </p>
          </div>
          <Checkbox
            checked={isInactivityEnabled}
            onChange={onInactivityEnabledChange}
          />
        </div>
        <div className="mt-3">
          <label
            className="text-xs text-slate-400"
            htmlFor="inactivity-minutes"
          >
            Inactivity minutes
          </label>
          <TextInput
            id="inactivity-minutes"
            type="number"
            min={1}
            value={inactivityMinutes}
            onChange={(event) => {
              const next = Number(event.target.value);
              onInactivityMinutesChange(
                Number.isFinite(next) && next > 0
                  ? next
                  : DEFAULT_INACTIVITY_MINUTES,
              );
            }}
            disabled={!isInactivityEnabled}
            className="mt-2 w-full px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-200 transition hover:border-slate-400"
        >
          Done
        </button>
      </div>
    </Dialog>
  );
}
