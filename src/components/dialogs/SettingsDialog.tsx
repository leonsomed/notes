import { ActionButton } from "../base/ActionButton";
import { Checkbox } from "../base/Checkbox";
import { IconButton } from "../base/IconButton";
import { Button } from "../base/Button";
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
  uploadNodeName: string;
  onUploadNodeNameChange: (value: string) => void;
  isUploadEnabled: boolean;
  onUploadEnabledChange: (value: boolean) => void;
  isUploadUrlValid: boolean;
  isUploadNodeNameValid: boolean;
  hasUploadChanges: boolean;
  restoreUploadUrl: string;
  onRestoreUploadUrlChange: (value: string) => void;
  onRestoreUploadUrlCommit: () => void;
  restoreNodeName: string;
  onRestoreNodeNameChange: (value: string) => void;
  restoreNodeOptions: string[];
  isRestoreUploadUrlValid: boolean;
  isRestoreNodesLoading: boolean;
  restoreNodesError: string | null;
  onRestoreUpload: () => void;
  isRestoreUploadBusy: boolean;
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
  uploadNodeName,
  onUploadNodeNameChange,
  isUploadEnabled,
  onUploadEnabledChange,
  isUploadUrlValid,
  isUploadNodeNameValid,
  hasUploadChanges,
  restoreUploadUrl,
  onRestoreUploadUrlChange,
  onRestoreUploadUrlCommit,
  restoreNodeName,
  onRestoreNodeNameChange,
  restoreNodeOptions,
  isRestoreUploadUrlValid,
  isRestoreNodesLoading,
  restoreNodesError,
  onRestoreUpload,
  isRestoreUploadBusy,
  isInactivityEnabled,
  onInactivityEnabledChange,
  inactivityMinutes,
  onInactivityMinutesChange,
}: SettingsDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog titleId="settings-dialog-title" size="lg" zIndex={40}>
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
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div>
            <p className="text-sm font-medium text-slate-100">Manual Backups</p>
            <p className="text-xs text-slate-400">
              Export a JSON backup or restore one manually.
            </p>
          </div>
          <div className="mt-3 grid gap-3">
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
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
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
              disabled={!isUploadUrlValid || !isUploadNodeNameValid}
              onChange={onUploadEnabledChange}
            />
          </div>
          <div className="mt-3">
            <label className="text-xs text-slate-400" htmlFor="upload-node-name">
              Node name
            </label>
            <TextInput
              id="upload-node-name"
              value={uploadNodeName}
              onChange={(event) => onUploadNodeNameChange(event.target.value)}
              placeholder="e.g. laptop-home"
              className="mt-2 w-full px-3 py-2 text-xs text-slate-200"
            />
            {!isUploadNodeNameValid ? (
              <p className="mt-2 text-xs text-slate-500">
                Enter a node name to enable uploads.
              </p>
            ) : null}
            <label
              className="mt-3 block text-xs text-slate-400"
              htmlFor="upload-url"
            >
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
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div>
            <p className="text-sm font-medium text-slate-100">Restore upload</p>
            <p className="text-xs text-slate-400">
              Load node names from a server before restoring notes.
            </p>
          </div>
          <div className="mt-3">
            <label
              className="text-xs text-slate-400"
              htmlFor="restore-upload-url"
            >
              Server URL
            </label>
            <TextInput
              id="restore-upload-url"
              value={restoreUploadUrl}
              onChange={(event) => onRestoreUploadUrlChange(event.target.value)}
              onBlur={onRestoreUploadUrlCommit}
              placeholder="https://example.com/api/notes/node-names"
              className="mt-2 w-full px-3 py-2 text-xs text-slate-200"
            />
            {!isRestoreUploadUrlValid && restoreUploadUrl.trim() ? (
              <p className="mt-2 text-xs text-slate-500">
                Enter a valid URL to load nodes.
              </p>
            ) : null}
            <label
              className="mt-3 block text-xs text-slate-400"
              htmlFor="restore-node-name"
            >
              Node name
            </label>
            <select
              id="restore-node-name"
              value={restoreNodeName}
              onChange={(event) => onRestoreNodeNameChange(event.target.value)}
              disabled={isRestoreNodesLoading || restoreNodeOptions.length === 0}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
            >
              {restoreNodeOptions.map((node) => (
                <option key={node} value={node}>
                  {node}
                </option>
              ))}
            </select>
            {restoreNodesError ? (
              <p className="mt-2 text-xs text-slate-500">{restoreNodesError}</p>
            ) : null}
            {isRestoreNodesLoading ? (
              <p className="mt-2 text-xs text-slate-500">Loading nodes...</p>
            ) : null}
            {!isRestoreNodesLoading &&
            isRestoreUploadUrlValid &&
            restoreNodeOptions.length === 0 &&
            !restoreNodesError ? (
              <p className="mt-2 text-xs text-slate-500">
                No nodes available for this server.
              </p>
            ) : null}
            <div className="mt-3 flex justify-end">
              <Button
                size="xsWide"
                onClick={onRestoreUpload}
                disabled={
                  isRestoreUploadBusy ||
                  !isRestoreUploadUrlValid ||
                  !restoreNodeName
                }
              >
                {isRestoreUploadBusy ? "Loading..." : "Restore from server"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose} size="xsWide">
          Done
        </Button>
      </div>
    </Dialog>
  );
}
