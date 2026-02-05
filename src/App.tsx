import { useEffect, useMemo, useRef, useState } from "react";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import {
  addDocument,
  deleteDocument,
  getDocuments,
  updateDocument,
  type NoteDocument,
} from "./notesDb";
import { NoteDocumentEditor } from "./NoteDocumentEditor";

const normalizeTag = (value: string) => value.trim().replace(/\s+/g, " ");

const tagKey = (value: string) => normalizeTag(value).toLowerCase();

const SELECTED_DOCUMENT_KEY = "notes:selectedDocumentId";

const getLatestDocumentId = (docs: NoteDocument[]) => {
  const latestDoc = docs.reduce<NoteDocument | null>((latest, doc) => {
    if (!latest) return doc;
    return doc.createdAt > latest.createdAt ? doc : latest;
  }, null);
  return latestDoc?.id ?? null;
};

function App() {
  const [documents, setDocuments] = useState<NoteDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTag, setDraftTag] = useState("");
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    getDocuments()
      .then((data) => {
        if (isMounted) {
          setDocuments(data);
          const storedRaw = sessionStorage.getItem(SELECTED_DOCUMENT_KEY);
          const parsedId = storedRaw ? Number(storedRaw) : null;
          const storedId = Number.isFinite(parsedId) ? parsedId : null;
          const hasStoredSelection =
            storedId !== null && data.some((doc) => doc.id === storedId);
          const latestId = getLatestDocumentId(data);
          setSelectedDocumentId(
            hasStoredSelection ? storedId : (latestId ?? null),
          );
        }
      })
      .catch((e) => {
        console.error(e);
        if (isMounted) setErrorMessage("Unable to load documents.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddDocument = async () => {
    try {
      const stored = await addDocument();
      setDocuments((prev) => [stored, ...prev]);
      setSelectedDocumentId(stored.id);
    } catch (e) {
      console.error(e);
      setErrorMessage("Unable to save document.");
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
    } catch (e) {
      console.error(e);
      setErrorMessage("Unable to delete document.");
    }
  };

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  useEffect(() => {
    if (selectedDocumentId) {
      sessionStorage.setItem(
        SELECTED_DOCUMENT_KEY,
        selectedDocumentId.toString(),
      );
    }
  }, [selectedDocumentId]);

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

    try {
      await updateDocument(selectedDocument.id, {
        ...selectedDocument,
        title: nextTitle,
      });
    } catch (e) {
      console.error(e);
      setErrorMessage("Unable to save title.");
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

    try {
      await updateDocument(selectedDocument.id, {
        ...selectedDocument,
        tags: nextTags,
      });
    } catch (e) {
      console.error(e);
      setErrorMessage("Unable to save tags.");
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

    try {
      await updateDocument(selectedDocument.id, {
        ...selectedDocument,
        tags: nextTags,
      });
    } catch (e) {
      console.error(e);
      setErrorMessage("Unable to save tags.");
    }
  };

  return (
    <div className="min-h-screen min-w-[320px] bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-900 bg-slate-950/60 px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Documents
              </p>
              <p className="text-sm text-slate-300">
                {isLoading ? "Loading..." : `${documents.length} total`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddDocument}
              className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              New
            </button>
          </div>

          {errorMessage ? (
            <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            {documents.length === 0 && !isLoading ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-4 text-xs text-slate-500">
                No documents yet. Create your first one.
              </div>
            ) : null}
            {[...documents]
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .map((doc) => {
                const isSelected = doc.id === selectedDocumentId;
                const createdAtLabel = new Date(
                  doc.createdAt,
                ).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocumentId(doc.id)}
                    className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "border-indigo-400 bg-indigo-500/10 text-white"
                        : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    <span className="font-medium">{doc.title}</span>
                    <span className="text-xs text-slate-500">
                      {createdAtLabel}
                    </span>
                  </button>
                );
              })}
          </div>
        </aside>

        <main className="flex flex-1 flex-col">
          {selectedDocument ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-8 py-6">
                <div>
                  {isEditingTitle ? (
                    <input
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
                      className="w-full max-w-105 rounded-lg border border-slate-800 bg-transparent px-2 py-1 text-2xl font-semibold text-white outline-none transition focus:border-indigo-400"
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
                      <input
                        value={draftTag}
                        onChange={(event) => setDraftTag(event.target.value)}
                        onFocus={() => setIsTagInputFocused(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            commitTag(draftTag);
                          }
                        }}
                        onBlur={() => {
                          setIsTagInputFocused(false);
                          if (draftTag.trim()) commitTag(draftTag);
                        }}
                        placeholder="/ to show all tags"
                        className="w-full rounded-lg border border-slate-800 bg-transparent px-2 py-1 text-xs text-slate-200 outline-none transition focus:border-indigo-400"
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
                              className="w-full px-2 py-1 text-left transition hover:bg-slate-900/60"
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
                  onClick={() => handleDelete(selectedDocument.id)}
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
                    updateDocument(selectedDocument.id, {
                      ...selectedDocument,
                      content: blocks,
                    }).catch((e) => {
                      console.error(e);
                      setErrorMessage("Unable to save changes.");
                    });
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
      </div>
    </div>
  );
}

export default App;
