import { useEffect, useState } from "react";
import type { NoteDocument } from "../services/notesDb";

const SELECTED_DOCUMENT_KEY = "notes:selectedDocumentId";
const UPLOAD_URL_KEY = "notes:uploadUrl";
const UPLOAD_ENABLED_KEY = "notes:uploadEnabled";
const INACTIVITY_ENABLED_KEY = "notes:inactivityEnabled";
const INACTIVITY_MINUTES_KEY = "notes:inactivityMinutes";
export const DEFAULT_INACTIVITY_MINUTES = 15;

const getLatestDocumentId = (docs: NoteDocument[]) => {
  const latestDoc = docs.reduce<NoteDocument | null>((latest, doc) => {
    if (!latest) return doc;
    return doc.createdAt > latest.createdAt ? doc : latest;
  }, null);
  return latestDoc?.id ?? null;
};

export function usePersistedPreferences(documents: NoteDocument[]) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    () => {
      const storedRaw = sessionStorage.getItem(SELECTED_DOCUMENT_KEY);
      const parsedId = storedRaw ? Number(storedRaw) : null;
      const storedId = Number.isFinite(parsedId) ? parsedId : null;
      const hasStoredSelection =
        storedId !== null && documents.some((doc) => doc.id === storedId);
      const latestId = getLatestDocumentId(documents);
      return hasStoredSelection ? storedId : (latestId ?? null);
    },
  );
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

  return {
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
  };
}
