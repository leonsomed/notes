import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDocument,
  deleteDocument,
  getEncryptedVaultRecord,
  restoreEncryptedVault,
  updateDocument,
  type NoteDocument,
} from "../services/notesDb";
import { DocumentListItem } from "./base/DocumentListItem";
import { IconButton } from "./base/IconButton";
import { NoteDocumentEditor } from "./base/NoteDocumentEditor";
import { TagEditor } from "./base/TagEditor";
import { TextInput } from "./base/TextInput";
import { TopBanner } from "./base/TopBanner";
import { normalizeTag, tagKey } from "../utils/tags";
import {
  isValidEncryptedRecord,
  type EncryptedVaultRecord,
} from "../services/crypto";
import { storeUploadAndGetUrl } from "../services/notesDb";
import { useNotesSearch } from "../hooks/useNotesSearch";
import { usePersistedPreferences } from "../hooks/usePersistedPreferences";
import { DeleteDialog } from "./dialogs/DeleteDialog";
import { RestoreDialog } from "./dialogs/RestoreDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";

const SAVE_DEBOUNCE_MS = 500;

const getLatestDocumentId = (docs: NoteDocument[]) => {
  const latestDoc = docs.reduce<NoteDocument | null>((latest, doc) => {
    if (!latest) return doc;
    return doc.createdAt > latest.createdAt ? doc : latest;
  }, null);
  return latestDoc?.id ?? null;
};

interface NotesAppProps {
  initialDocuments: NoteDocument[];
}

export function NotesApp({ initialDocuments }: NotesAppProps) {
  const [documents, setDocuments] = useState<NoteDocument[]>(initialDocuments);
  const {
    selectedDocumentId,
    setSelectedDocumentId,
    uploadUrl,
    setUploadUrl,
    isUploadEnabled,
    setIsUploadEnabled,
    isInactivityEnabled,
    setIsInactivityEnabled,
    inactivityMinutes,
    setInactivityMinutes,
  } = usePersistedPreferences(initialDocuments);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const { filteredDocuments, hasActiveSearch, searchQuery, setSearchQuery } =
    useNotesSearch(documents);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasUploadChanges, setHasUploadChanges] = useState(false);
  const [showUploadFailureBanner, setShowUploadFailureBanner] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [restoreRecord, setRestoreRecord] =
    useState<EncryptedVaultRecord | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoreBusy, setIsRestoreBusy] = useState(false);
  const inactivityTimeoutRef = useRef<number | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInFlightRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<{
    id: number;
    doc: NoteDocument;
  } | null>(null);

  const flushPendingSave = useCallback(() => {
    if (!pendingSaveRef.current) return;
    const { id, doc } = pendingSaveRef.current;
    pendingSaveRef.current = null;
    updateDocument(id, doc).catch((e) => {
      console.error(e);
      alert("Unable to save changes.");
    });
  }, []);
  const scheduleSave = useCallback(
    (id: number, doc: NoteDocument) => {
      if (pendingSaveRef.current && pendingSaveRef.current.id !== id) {
        flushPendingSave();
      }
      pendingSaveRef.current = { id, doc };
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        saveTimeoutRef.current = null;
        flushPendingSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushPendingSave],
  );
  const markUploadDirty = useCallback(() => {
    setHasUploadChanges(true);
  }, []);

  const handleAddDocument = async () => {
    try {
      const stored = await addDocument();
      setDocuments((prev) => [stored, ...prev]);
      setSelectedDocumentId(stored.id);
      markUploadDirty();
    } catch (e) {
      console.error(e);
      alert("Unable to save document.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      setSelectedDocumentId((prev) => {
        if (prev !== id) return prev;
        return documents.find((doc) => doc.id !== id)?.id ?? null;
      });
      markUploadDirty();
    } catch (e) {
      console.error(e);
      alert("Unable to delete document.");
    }
  };

  const pendingDeleteDoc =
    pendingDeleteId === null
      ? null
      : (documents.find((doc) => doc.id === pendingDeleteId) ?? null);

  const handleConfirmDelete = async () => {
    if (pendingDeleteId === null) return;
    await handleDelete(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const trimmedUploadUrl = uploadUrl.trim();
  const isUploadUrlValid = useMemo(() => {
    if (!trimmedUploadUrl) return false;
    try {
      const url = new URL(trimmedUploadUrl);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, [trimmedUploadUrl]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );
  const handleUpload = useCallback(async () => {
    if (!isUploadUrlValid) return;
    flushPendingSave();
    setShowUploadFailureBanner(false);
    try {
      const payload = await getEncryptedVaultRecord();
      const response = await fetch(trimmedUploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      setHasUploadChanges(false);
    } catch (e) {
      console.error(e);
      if (e instanceof TypeError) {
        setShowUploadFailureBanner(true);
      }
    }
  }, [flushPendingSave, isUploadUrlValid, trimmedUploadUrl]);

  const runUpload = useCallback(async () => {
    if (uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    await handleUpload();
    uploadInFlightRef.current = false;
  }, [handleUpload]);

  const uploadIfNeeded = useCallback(async () => {
    if (!isUploadEnabled) return;
    if (!hasUploadChanges) return;
    if (!isUploadUrlValid) return;
    await runUpload();
  }, [hasUploadChanges, isUploadEnabled, isUploadUrlValid, runUpload]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      flushPendingSave();
    };
  }, [flushPendingSave]);
  useEffect(() => {
    if (isUploadEnabled && !isUploadUrlValid) {
      setIsUploadEnabled(false);
    }
  }, [isUploadEnabled, isUploadUrlValid, setIsUploadEnabled]);
  useEffect(() => {
    if (!hasUploadChanges) {
      setShowUploadFailureBanner(false);
    }
  }, [hasUploadChanges]);
  useEffect(() => {
    if (!isUploadEnabled) return;
    const handleWindowBlur = () => {
      uploadIfNeeded();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        uploadIfNeeded();
      }
    };
    const handleBeforeUnload = () => {
      uploadIfNeeded();
    };
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isUploadEnabled, uploadIfNeeded]);

  const handleAutoLock = useCallback(async () => {
    try {
      flushPendingSave();
      await uploadIfNeeded();
    } finally {
      window.location.reload();
    }
  }, [flushPendingSave, uploadIfNeeded]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current !== null) {
      window.clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    if (!isInactivityEnabled) return;
    const delayMs = Math.max(1, inactivityMinutes) * 60 * 1000;
    inactivityTimeoutRef.current = window.setTimeout(() => {
      inactivityTimeoutRef.current = null;
      handleAutoLock();
    }, delayMs);
  }, [handleAutoLock, inactivityMinutes, isInactivityEnabled]);

  useEffect(() => {
    resetInactivityTimer();
    if (!isInactivityEnabled) return;

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );
    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity),
      );
    };
  }, [isInactivityEnabled, resetInactivityTimer]);

  const handleExport = async () => {
    flushPendingSave();
    try {
      const payload = await getEncryptedVaultRecord();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notes-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Unable to export notes.");
    }
  };

  const handleRestoreClick = () => {
    restoreInputRef.current?.click();
  };

  const handleRestoreSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isValidEncryptedRecord(parsed)) {
        alert("Invalid vault export file.");
        return;
      }
      const confirmed = window.confirm(
        "Restore will replace your current notes. Continue?",
      );
      if (!confirmed) return;
      setRestoreRecord(parsed);
      setRestorePassword("");
      setRestoreError(null);
    } catch (e) {
      console.error(e);
      alert("Unable to restore notes.");
    }
  };

  const handleRestoreCancel = () => {
    setRestoreRecord(null);
    setRestorePassword("");
    setRestoreError(null);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreRecord) return;
    const trimmed = restorePassword.trim();
    if (!trimmed) {
      setRestoreError("Enter the vault password to decrypt this export.");
      return;
    }
    setIsRestoreBusy(true);
    setRestoreError(null);
    try {
      setIsLoading(true);
      flushPendingSave();
      const payload = await restoreEncryptedVault(trimmed, restoreRecord);
      setDocuments(payload.documents);
      setSelectedDocumentId(getLatestDocumentId(payload.documents));
      setPendingDeleteId(null);
      setSearchQuery("");
      markUploadDirty();
      handleRestoreCancel();
    } catch (e) {
      console.error(e);
      setRestoreError("Unable to decrypt vault. Check your password.");
    } finally {
      setIsLoading(false);
      setIsRestoreBusy(false);
    }
  };

  const tagSuggestions = useMemo(() => {
    const uniqueTags = new Map<string, string>();
    documents.forEach((doc) => {
      doc.tags.forEach((tag) => {
        const key = tagKey(tag);
        if (!uniqueTags.has(key)) uniqueTags.set(key, normalizeTag(tag));
      });
    });
    const selectedKeys = new Set(
      (selectedDocument?.tags ?? []).map((tag) => tagKey(tag)),
    );
    return Array.from(uniqueTags.entries())
      .filter(([key]) => !selectedKeys.has(key))
      .map(([, tag]) => tag)
      .sort((a, b) => a.localeCompare(b));
  }, [documents, selectedDocument?.tags]);

  useEffect(() => {
    setIsEditingTitle(false);
    setDraftTitle(selectedDocument?.title ?? "");
  }, [selectedDocument?.id, selectedDocument?.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const commitTitleChange = async () => {
    if (!selectedDocument) return;
    const nextTitle = draftTitle.trim() || "Untitled";
    setIsEditingTitle(false);
    setDraftTitle(nextTitle);

    if (nextTitle === selectedDocument.title) return;

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === selectedDocument.id ? { ...doc, title: nextTitle } : doc,
      ),
    );
    markUploadDirty();

    try {
      await updateDocument(selectedDocument.id, {
        ...selectedDocument,
        title: nextTitle,
      });
    } catch (e) {
      console.error(e);
      alert("Unable to save title.");
    }
  };

  const commitTag = async (value: string) => {
    if (!selectedDocument) return;
    const normalizedTag = normalizeTag(value);
    if (!normalizedTag) return;

    if (selectedDocument.tags.includes(normalizedTag)) {
      alert("Tag already exists");
      return;
    }

    const nextTags = [...selectedDocument.tags, normalizedTag];
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === selectedDocument.id ? { ...doc, tags: nextTags } : doc,
      ),
    );
    markUploadDirty();

    try {
      await updateDocument(selectedDocument.id, {
        ...selectedDocument,
        tags: nextTags,
      });
    } catch (e) {
      console.error(e);
      alert("Unable to save tags.");
    }
  };

  const removeTag = async (tagToRemove: string) => {
    if (!selectedDocument) return;
    const nextTags = selectedDocument.tags.filter((tag) => tag !== tagToRemove);
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === selectedDocument.id ? { ...doc, tags: nextTags } : doc,
      ),
    );
    markUploadDirty();

    try {
      await updateDocument(selectedDocument.id, {
        ...selectedDocument,
        tags: nextTags,
      });
    } catch (e) {
      console.error(e);
      alert("Unable to save tags.");
    }
  };

  const shouldShowConfigBanner =
    hasUploadChanges && (!isUploadUrlValid || !isUploadEnabled);
  const shouldShowUploadFailureBanner =
    !shouldShowConfigBanner &&
    showUploadFailureBanner &&
    hasUploadChanges &&
    isUploadUrlValid;

  return (
    <div className="min-h-screen min-w-[320px] bg-slate-950 text-white">
      {shouldShowConfigBanner ? (
        <TopBanner
          message="You have not configured an upload server. Your changes are only saved in this browser."
          actionLabel="Add server"
          onAction={() => setIsSettingsOpen(true)}
        />
      ) : null}
      {shouldShowUploadFailureBanner ? (
        <TopBanner
          message="Server unreachable. You have changes that have not been pushed."
          actionLabel="Upload now"
          onAction={runUpload}
        />
      ) : null}
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-900 bg-slate-950/60 px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Documents
              </p>
              <p className="text-sm text-slate-300">
                {isLoading
                  ? "Loading..."
                  : `${filteredDocuments.length} of ${documents.length}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={handleAddDocument}
                className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400"
              >
                New
              </button>
            </div>
          </div>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json"
            onChange={handleRestoreSelected}
            className="hidden"
            aria-hidden="true"
          />

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
            <TextInput
              variant="bare"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search notes or tag:my-tag"
              className="w-full text-xs text-slate-200"
              aria-label="Search notes or tag:my-tag"
            />
            {searchQuery ? (
              <IconButton
                onClick={() => setSearchQuery("")}
                className="px-1 text-slate-500 hover:text-slate-200"
                ariaLabel="Clear search"
              />
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {documents.length === 0 && !isLoading ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-4 text-xs text-slate-500">
                No documents yet. Create your first one.
              </div>
            ) : null}
            {filteredDocuments.length === 0 && hasActiveSearch ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-4 text-xs text-slate-500">
                No matches found.
              </div>
            ) : null}
            {filteredDocuments.map((doc) => (
              <DocumentListItem
                key={doc.id}
                document={doc}
                isSelected={doc.id === selectedDocumentId}
                onSelect={() => setSelectedDocumentId(doc.id)}
              />
            ))}
          </div>
        </aside>

        <main className="flex flex-1 flex-col">
          {selectedDocument ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-8 py-6">
                <div>
                  {isEditingTitle ? (
                    <TextInput
                      ref={titleInputRef}
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onBlur={commitTitleChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          setDraftTitle(selectedDocument.title);
                          setIsEditingTitle(false);
                        }
                      }}
                      className="w-full max-w-105 px-2 py-1 text-2xl font-semibold text-white"
                    />
                  ) : (
                    <h1
                      className="cursor-text text-2xl font-semibold text-white"
                      onClick={() => setIsEditingTitle(true)}
                    >
                      {selectedDocument.title}
                    </h1>
                  )}
                  <p className="text-sm text-slate-400">
                    Edit the selected document. Changes save automatically.
                  </p>
                  <TagEditor
                    key={selectedDocument.id}
                    tags={selectedDocument.tags}
                    suggestions={tagSuggestions}
                    onCommitTag={commitTag}
                    onRemoveTag={removeTag}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(selectedDocument.id)}
                  className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-300"
                >
                  Delete
                </button>
              </div>

              <div className="flex-1 min-h-0 bg-[#1f1f1f]">
                <NoteDocumentEditor
                  key={selectedDocument.id}
                  initialContent={selectedDocument.content}
                  className="h-full w-full"
                  uploadFile={storeUploadAndGetUrl}
                  onChange={(blocks) => {
                    setDocuments((prev) =>
                      prev.map((doc) =>
                        doc.id === selectedDocument.id
                          ? { ...doc, content: blocks }
                          : doc,
                      ),
                    );
                    scheduleSave(selectedDocument.id, {
                      ...selectedDocument,
                      content: blocks,
                    });
                    markUploadDirty();
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                Select a document to begin.
              </div>
            </div>
          )}
        </main>
        <DeleteDialog
          isOpen={pendingDeleteId !== null}
          documentTitle={pendingDeleteDoc?.title}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={handleConfirmDelete}
        />
        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onExport={handleExport}
          onRestore={handleRestoreClick}
          uploadUrl={uploadUrl}
          onUploadUrlChange={setUploadUrl}
          isUploadEnabled={isUploadEnabled}
          onUploadEnabledChange={setIsUploadEnabled}
          isUploadUrlValid={isUploadUrlValid}
          hasUploadChanges={hasUploadChanges}
          isInactivityEnabled={isInactivityEnabled}
          onInactivityEnabledChange={setIsInactivityEnabled}
          inactivityMinutes={inactivityMinutes}
          onInactivityMinutesChange={setInactivityMinutes}
        />
        <RestoreDialog
          isOpen={Boolean(restoreRecord)}
          password={restorePassword}
          onPasswordChange={setRestorePassword}
          error={restoreError}
          isBusy={isRestoreBusy}
          onCancel={handleRestoreCancel}
          onConfirm={handleRestoreConfirm}
        />
      </div>
    </div>
  );
}
