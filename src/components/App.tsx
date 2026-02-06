import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import {
  addDocument,
  deleteDocument,
  initializeVault,
  getEncryptedVaultRecord,
  restoreEncryptedVault,
  updateDocument,
  type NoteDocument,
  type EncryptedVaultRecord,
} from "../services/notesDb";
import { BackupActionButton } from "./BackupActionButton";
import { DocumentListItem } from "./DocumentListItem";
import { NoteDocumentEditor } from "./NoteDocumentEditor";
import { PairingGate } from "./PairingGate";
import { SettingsCheckbox } from "./SettingsCheckbox";
import { TextInput } from "./TextInput";
import { TopBanner } from "./TopBanner";

const normalizeTag = (value: string) => value.trim().replace(/\s+/g, " ");

const tagKey = (value: string) => normalizeTag(value).toLowerCase();

const SELECTED_DOCUMENT_KEY = "notes:selectedDocumentId";
const UPLOAD_URL_KEY = "notes:uploadUrl";
const UPLOAD_ENABLED_KEY = "notes:uploadEnabled";
const INACTIVITY_ENABLED_KEY = "notes:inactivityEnabled";
const INACTIVITY_MINUTES_KEY = "notes:inactivityMinutes";
const DEFAULT_INACTIVITY_MINUTES = 15;
const SAVE_DEBOUNCE_MS = 500;

const getLatestDocumentId = (docs: NoteDocument[]) => {
  const latestDoc = docs.reduce<NoteDocument | null>((latest, doc) => {
    if (!latest) return doc;
    return doc.createdAt > latest.createdAt ? doc : latest;
  }, null);
  return latestDoc?.id ?? null;
};

const normalizeSearchText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

const extractTextFromBlocks = (blocks: NoteDocument["content"]) => {
  if (!blocks) return "";
  const parts: string[] = [];

  const collectInlineText = (content: unknown) => {
    if (!Array.isArray(content)) return;
    content.forEach((item) => {
      if (typeof item === "string") {
        parts.push(item);
        return;
      }
      if (item && typeof item === "object") {
        const maybeText = (item as { text?: unknown }).text;
        if (typeof maybeText === "string") parts.push(maybeText);
        const nested = (item as { content?: unknown }).content;
        if (Array.isArray(nested)) collectInlineText(nested);
      }
    });
  };

  const walkBlocks = (items: NoteDocument["content"]) => {
    if (!items) return;
    items.forEach((block) => {
      if (!block || typeof block !== "object") return;
      const maybeContent = (block as { content?: unknown }).content;
      if (Array.isArray(maybeContent)) collectInlineText(maybeContent);
      const maybeChildren = (block as { children?: unknown }).children;
      if (Array.isArray(maybeChildren)) walkBlocks(maybeChildren);
    });
  };

  walkBlocks(blocks);
  return parts.join(" ");
};

const isValidEncryptedRecord = (
  value: unknown,
): value is EncryptedVaultRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as EncryptedVaultRecord;
  return (
    typeof record.version === "number" &&
    typeof record.salt === "string" &&
    typeof record.iv === "string" &&
    typeof record.ciphertext === "string"
  );
};

const fuzzyScore = (query: string, text: string) => {
  if (!query || !text) return 0;
  if (text.includes(query)) {
    const lengthBonus = Math.min(
      30,
      Math.round((query.length / text.length) * 20),
    );
    return 100 + lengthBonus;
  }
  let score = 0;
  let lastIndex = -1;
  let consecutive = 0;
  for (let i = 0; i < query.length; i += 1) {
    const nextIndex = text.indexOf(query[i], lastIndex + 1);
    if (nextIndex === -1) return 0;
    if (nextIndex === lastIndex + 1) {
      consecutive += 1;
      score += 5 + consecutive;
    } else {
      consecutive = 0;
      score += 2;
    }
    if (nextIndex === 0 || /[\s._-]/.test(text[nextIndex - 1])) {
      score += 3;
    }
    lastIndex = nextIndex;
  }
  return score;
};

const scoreDocument = (doc: NoteDocument, tokens: string[]) => {
  if (tokens.length === 0) return 0;
  const titleText = normalizeSearchText(doc.title);
  const tagsText = normalizeSearchText(doc.tags.join(" "));
  const contentText = normalizeSearchText(extractTextFromBlocks(doc.content));
  const fields = [
    { text: titleText, weight: 3 },
    { text: tagsText, weight: 2 },
    { text: contentText, weight: 1 },
  ];

  let score = 0;
  for (const token of tokens) {
    let bestTokenScore = 0;
    for (const field of fields) {
      const fieldScore = fuzzyScore(token, field.text);
      if (fieldScore > 0) {
        bestTokenScore = Math.max(bestTokenScore, fieldScore * field.weight);
      }
    }
    if (bestTokenScore === 0) return 0;
    score += bestTokenScore;
  }
  return score;
};

function NotesApp({ initialDocuments }: { initialDocuments: NoteDocument[] }) {
  const [documents, setDocuments] = useState<NoteDocument[]>(initialDocuments);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    () => {
      const storedRaw = sessionStorage.getItem(SELECTED_DOCUMENT_KEY);
      const parsedId = storedRaw ? Number(storedRaw) : null;
      const storedId = Number.isFinite(parsedId) ? parsedId : null;
      const hasStoredSelection =
        storedId !== null &&
        initialDocuments.some((doc) => doc.id === storedId);
      const latestId = getLatestDocumentId(initialDocuments);
      return hasStoredSelection ? storedId : (latestId ?? null);
    },
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTag, setDraftTag] = useState("");
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [activeTagIndex, setActiveTagIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [uploadUrl, setUploadUrl] = useState(
    () => localStorage.getItem(UPLOAD_URL_KEY) ?? "",
  );
  const [isUploadEnabled, setIsUploadEnabled] = useState(
    () => localStorage.getItem(UPLOAD_ENABLED_KEY) === "true",
  );
  const [isInactivityEnabled, setIsInactivityEnabled] = useState(
    () => localStorage.getItem(INACTIVITY_ENABLED_KEY) === "true",
  );
  const [inactivityMinutes, setInactivityMinutes] = useState(() => {
    const raw = Number(localStorage.getItem(INACTIVITY_MINUTES_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INACTIVITY_MINUTES;
  });
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
    if (selectedDocumentId) {
      sessionStorage.setItem(
        SELECTED_DOCUMENT_KEY,
        selectedDocumentId.toString(),
      );
    }
  }, [selectedDocumentId]);
  useEffect(() => {
    localStorage.setItem(UPLOAD_URL_KEY, uploadUrl);
  }, [uploadUrl]);
  useEffect(() => {
    localStorage.setItem(UPLOAD_ENABLED_KEY, String(isUploadEnabled));
  }, [isUploadEnabled]);
  useEffect(() => {
    localStorage.setItem(INACTIVITY_ENABLED_KEY, String(isInactivityEnabled));
  }, [isInactivityEnabled]);
  useEffect(() => {
    localStorage.setItem(INACTIVITY_MINUTES_KEY, String(inactivityMinutes));
  }, [inactivityMinutes]);
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
  }, [isUploadEnabled, isUploadUrlValid]);
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

  const visibleTagSuggestions = useMemo(() => {
    if (draftTag === "/") return tagSuggestions;
    const query = normalizeTag(draftTag);
    if (!query) return tagSuggestions;
    const queryKey = tagKey(query);
    return tagSuggestions.filter((tag) => tagKey(tag).startsWith(queryKey));
  }, [draftTag, tagSuggestions]);

  useEffect(() => {
    if (!isTagInputFocused || visibleTagSuggestions.length === 0) {
      setActiveTagIndex(-1);
      return;
    }
    setActiveTagIndex((current) =>
      current >= visibleTagSuggestions.length ? -1 : current,
    );
  }, [isTagInputFocused, visibleTagSuggestions]);

  const tagSearchQuery = useMemo(() => {
    const trimmed = searchQuery.trim();
    const match = /^tag:\s*(.*)$/i.exec(trimmed);
    if (!match) return null;
    return normalizeTag(match[1]);
  }, [searchQuery]);

  const searchTokens = useMemo(() => {
    if (tagSearchQuery !== null) return [];
    const normalized = normalizeSearchText(searchQuery);
    if (!normalized) return [];
    return normalized.split(" ").filter(Boolean);
  }, [searchQuery, tagSearchQuery]);

  const filteredDocuments = useMemo(() => {
    if (tagSearchQuery !== null) {
      if (!tagSearchQuery) return [];
      const queryKey = tagKey(tagSearchQuery);
      return documents
        .filter((doc) => doc.tags.some((tag) => tagKey(tag) === queryKey))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
    if (searchTokens.length === 0) {
      return [...documents].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return documents
      .map((doc) => ({ doc, score: scoreDocument(doc, searchTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (
          new Date(b.doc.createdAt).getTime() -
          new Date(a.doc.createdAt).getTime()
        );
      })
      .map((entry) => entry.doc);
  }, [documents, searchTokens, tagSearchQuery]);

  const hasActiveSearch = searchTokens.length > 0 || tagSearchQuery !== null;

  useEffect(() => {
    setIsEditingTitle(false);
    setDraftTitle(selectedDocument?.title ?? "");
    setDraftTag("");
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

    const nextKey = tagKey(normalizedTag);
    const existingKeys = new Set(
      selectedDocument.tags.map((tag) => tagKey(tag)),
    );
    if (existingKeys.has(nextKey)) {
      setDraftTag("");
      return;
    }

    const nextTags = [...selectedDocument.tags, normalizedTag];
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === selectedDocument.id ? { ...doc, tags: nextTags } : doc,
      ),
    );
    setDraftTag("");
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
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="rounded-full px-1 text-slate-500 transition hover:text-slate-200"
                aria-label="Clear search"
              >
                ×
              </button>
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
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {selectedDocument.tags.length > 0 ? (
                      selectedDocument.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/40 px-2 py-1 text-xs text-slate-300"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="rounded-full px-1 text-slate-500 transition hover:text-rose-300"
                            aria-label={`Remove ${tag} tag`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        No tags yet.
                      </span>
                    )}
                    <div className="relative min-w-40">
                      <TextInput
                        value={draftTag}
                        onChange={(event) => setDraftTag(event.target.value)}
                        onFocus={() => setIsTagInputFocused(true)}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown") {
                            if (visibleTagSuggestions.length === 0) return;
                            event.preventDefault();
                            setActiveTagIndex((current) =>
                              current < 0
                                ? 0
                                : Math.min(
                                    current + 1,
                                    visibleTagSuggestions.length - 1,
                                  ),
                            );
                            return;
                          }
                          if (event.key === "ArrowUp") {
                            if (visibleTagSuggestions.length === 0) return;
                            event.preventDefault();
                            setActiveTagIndex((current) =>
                              current < 0
                                ? visibleTagSuggestions.length - 1
                                : Math.max(current - 1, 0),
                            );
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setDraftTag("");
                            setIsTagInputFocused(false);
                            setActiveTagIndex(-1);
                            event.currentTarget.blur();
                            return;
                          }
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            if (activeTagIndex >= 0) {
                              commitTag(visibleTagSuggestions[activeTagIndex]);
                            } else {
                              commitTag(draftTag);
                            }
                          }
                        }}
                        onBlur={() => {
                          setIsTagInputFocused(false);
                          setActiveTagIndex(-1);
                          if (draftTag.trim()) commitTag(draftTag);
                        }}
                        placeholder="/ to show all tags"
                        className="w-full px-2 py-1 text-xs text-slate-200"
                      />
                      {isTagInputFocused &&
                      (draftTag.trim() || draftTag === "/") &&
                      visibleTagSuggestions.length > 0 ? (
                        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 shadow-lg">
                          {visibleTagSuggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                commitTag(tag);
                              }}
                              className={`w-full px-2 py-1 text-left transition hover:bg-slate-900/60 ${
                                activeTagIndex >= 0 &&
                                visibleTagSuggestions[activeTagIndex] === tag
                                  ? "bg-slate-900/60"
                                  : ""
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
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
        {pendingDeleteId !== null ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-xl">
              <h2
                id="delete-dialog-title"
                className="text-base font-semibold text-slate-100"
              >
                Delete document "{pendingDeleteDoc?.title}"?
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(null)}
                  className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-200 transition hover:border-slate-400"
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-full border border-rose-500 bg-rose-500/10 px-4 py-1 text-xs text-rose-200 transition hover:bg-rose-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {isSettingsOpen ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-xl">
              <div className="flex items-center justify-between">
                <h2
                  id="settings-dialog-title"
                  className="text-base font-semibold text-slate-100"
                >
                  Settings
                </h2>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-full px-2 py-1 text-sm text-slate-400 transition hover:text-slate-200"
                  aria-label="Close settings"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Manage your data exports and restores.
              </p>
              <div className="mt-4 grid gap-3">
                <BackupActionButton
                  label="Export notes"
                  description="Download a JSON backup"
                  onClick={handleExport}
                />
                <BackupActionButton
                  label="Restore notes"
                  description="Replace with a backup"
                  onClick={handleRestoreClick}
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
                  <SettingsCheckbox
                    checked={isUploadEnabled}
                    disabled={!isUploadUrlValid}
                    onChange={setIsUploadEnabled}
                  />
                </div>
                <div className="mt-3">
                  <label
                    className="text-xs text-slate-400"
                    htmlFor="upload-url"
                  >
                    Server URL
                  </label>
                  <TextInput
                    id="upload-url"
                    value={uploadUrl}
                    onChange={(event) => setUploadUrl(event.target.value)}
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
                  <SettingsCheckbox
                    checked={isInactivityEnabled}
                    onChange={setIsInactivityEnabled}
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
                      setInactivityMinutes(
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
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-200 transition hover:border-slate-400"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {restoreRecord ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-dialog-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-xl">
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
                value={restorePassword}
                onChange={(event) => setRestorePassword(event.target.value)}
                className="mt-2 w-full px-3 py-2 text-sm text-slate-200"
              />
              {restoreError ? (
                <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {restoreError}
                </p>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRestoreCancel}
                  className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-200 transition hover:border-slate-400"
                  disabled={isRestoreBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestoreConfirm}
                  className="rounded-full border border-indigo-500 bg-indigo-500/10 px-4 py-1 text-xs text-indigo-100 transition hover:bg-indigo-500/20"
                  disabled={isRestoreBusy}
                >
                  {isRestoreBusy ? "Restoring..." : "Restore"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [initialDocuments, setInitialDocuments] = useState<NoteDocument[]>([]);

  const handleUnlock = useCallback(async (password: string) => {
    setIsUnlocking(true);
    setUnlockError(null);
    try {
      const payload = await initializeVault(password);
      setInitialDocuments(payload.documents);
      setIsUnlocked(true);
    } catch (e) {
      console.error(e);
      setUnlockError("Unable to decrypt notes. Check your password.");
    } finally {
      setIsUnlocking(false);
    }
  }, []);

  if (!isUnlocked) {
    return (
      <PairingGate
        onUnlock={handleUnlock}
        isUnlocking={isUnlocking}
        errorMessage={unlockError}
      />
    );
  }

  return <NotesApp initialDocuments={initialDocuments} />;
}

export default App;
