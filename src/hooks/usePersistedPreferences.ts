import { useEffect, useState } from "react";
import type { NoteDocument } from "../services/notesDb";

const SELECTED_DOCUMENT_KEY = "notes:selectedDocumentId";
const UPLOAD_URL_KEY = "notes:uploadUrl";
const UPLOAD_NODE_NAME_KEY = "notes:uploadNodeName";
const UPLOAD_ENABLED_KEY = "notes:uploadEnabled";
const UPLOAD_AUTH_TOKEN_KEY = "notes:uploadAuthToken";
const RESTORE_UPLOAD_URL_KEY = "notes:restoreUploadUrl";
const RESTORE_NODE_NAME_KEY = "notes:restoreNodeName";
const RESTORE_AUTH_TOKEN_KEY = "notes:restoreAuthToken";
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
  const [uploadNodeName, setUploadNodeName] = useState(
    () => localStorage.getItem(UPLOAD_NODE_NAME_KEY) ?? "",
  );
  const [isUploadEnabled, setIsUploadEnabled] = useState(
    () => localStorage.getItem(UPLOAD_ENABLED_KEY) === "true",
  );
  const [uploadAuthToken, setUploadAuthToken] = useState(
    () => localStorage.getItem(UPLOAD_AUTH_TOKEN_KEY) ?? "",
  );
  const [restoreUploadUrl, setRestoreUploadUrl] = useState(
    () => localStorage.getItem(RESTORE_UPLOAD_URL_KEY) ?? "",
  );
  const [restoreNodeName, setRestoreNodeName] = useState(
    () => localStorage.getItem(RESTORE_NODE_NAME_KEY) ?? "",
  );
  const [restoreAuthToken, setRestoreAuthToken] = useState(
    () => localStorage.getItem(RESTORE_AUTH_TOKEN_KEY) ?? "",
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
    localStorage.setItem(UPLOAD_NODE_NAME_KEY, uploadNodeName);
  }, [uploadNodeName]);
  useEffect(() => {
    localStorage.setItem(UPLOAD_ENABLED_KEY, String(isUploadEnabled));
  }, [isUploadEnabled]);
  useEffect(() => {
    localStorage.setItem(UPLOAD_AUTH_TOKEN_KEY, uploadAuthToken);
  }, [uploadAuthToken]);
  useEffect(() => {
    localStorage.setItem(RESTORE_UPLOAD_URL_KEY, restoreUploadUrl);
  }, [restoreUploadUrl]);
  useEffect(() => {
    localStorage.setItem(RESTORE_NODE_NAME_KEY, restoreNodeName);
  }, [restoreNodeName]);
  useEffect(() => {
    localStorage.setItem(RESTORE_AUTH_TOKEN_KEY, restoreAuthToken);
  }, [restoreAuthToken]);
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
    uploadNodeName,
    setUploadNodeName,
    isUploadEnabled,
    setIsUploadEnabled,
    uploadAuthToken,
    setUploadAuthToken,
    restoreUploadUrl,
    setRestoreUploadUrl,
    restoreNodeName,
    setRestoreNodeName,
    restoreAuthToken,
    setRestoreAuthToken,
    isInactivityEnabled,
    setIsInactivityEnabled,
    inactivityMinutes,
    setInactivityMinutes,
  };
}
