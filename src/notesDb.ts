import type { PartialBlock } from "@blocknote/core";

const DB_NAME = "notes-db";
const DB_VERSION = 2;
const NOTES_STORE = "notes";
const UPLOADS_STORE = "uploads";
const VAULT_STORE = "vault";
const VAULT_KEY = "payload";

const CURRENT_VERSION = 1;
const DEFAULT_TITLE = "Untitled";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface StoredDocument {
  version: number;
  title: string;
  createdAt: number;
  content: PartialBlock[] | undefined;
  tags: string[];
}

interface StoredUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  data: Blob;
}

export interface EncryptedVaultRecord {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface NoteDocument extends StoredDocument {
  id: number;
}

export interface ExportedUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  dataUrl: string;
}

export interface ExportedNotesPayload {
  version: number;
  exportedAt: number;
  documents: NoteDocument[];
  uploads: ExportedUpload[];
}

let sessionPassword: string | null = null;
let cachedVault: ExportedNotesPayload | null = null;

function openNotesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const bufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToBuffer = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const createEmptyPayload = (): ExportedNotesPayload => ({
  version: CURRENT_VERSION,
  exportedAt: Date.now(),
  documents: [],
  uploads: [],
});

const requireUnlocked = () => {
  if (!sessionPassword || !cachedVault) {
    throw new Error("Vault is locked.");
  }
};

async function deriveKey(password: string, salt: Uint8Array) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPayload(
  password: string,
  payload: ExportedNotesPayload,
): Promise<EncryptedVaultRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    version: 1,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertext),
  };
}

async function decryptPayload(
  password: string,
  record: EncryptedVaultRecord,
): Promise<ExportedNotesPayload> {
  const salt = new Uint8Array(base64ToBuffer(record.salt));
  const iv = new Uint8Array(base64ToBuffer(record.iv));
  const ciphertext = base64ToBuffer(record.ciphertext);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  const decoded = decoder.decode(plaintext);
  return JSON.parse(decoded) as ExportedNotesPayload;
}

async function readVaultRecord(): Promise<EncryptedVaultRecord | null> {
  const db = await openNotesDb();
  if (!db.objectStoreNames.contains(VAULT_STORE)) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readonly");
    const store = tx.objectStore(VAULT_STORE);
    const request = store.get(VAULT_KEY);
    request.onsuccess = () => {
      resolve((request.result as EncryptedVaultRecord | undefined) ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function writeVaultRecord(record: EncryptedVaultRecord): Promise<void> {
  const db = await openNotesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readwrite");
    const store = tx.objectStore(VAULT_STORE);
    store.put(record, VAULT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearPlaintextStores(): Promise<void> {
  const db = await openNotesDb();
  const storesToClear = [NOTES_STORE, UPLOADS_STORE].filter((name) =>
    db.objectStoreNames.contains(name),
  );
  if (storesToClear.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storesToClear, "readwrite");
    storesToClear.forEach((name) => {
      tx.objectStore(name).clear();
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEncryptedVaultRecord(): Promise<EncryptedVaultRecord> {
  const record = await readVaultRecord();
  if (!record) {
    throw new Error("Vault is empty.");
  }
  return record;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read file."));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read blob."));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function readPlaintextPayload(): Promise<ExportedNotesPayload> {
  const db = await openNotesDb();
  const hasNotesStore = db.objectStoreNames.contains(NOTES_STORE);
  const hasUploadsStore = db.objectStoreNames.contains(UPLOADS_STORE);
  const docs = hasNotesStore
    ? await new Promise<NoteDocument[]>((resolve, reject) => {
        const tx = db.transaction(NOTES_STORE, "readonly");
        const store = tx.objectStore(NOTES_STORE);
        const getAllRequest = store.getAll();
        const getKeysRequest = store.getAllKeys();
        tx.oncomplete = () => {
          const documents = (getAllRequest.result as StoredDocument[]).map(
            (value, index) => ({
              ...value,
              id: Number(getKeysRequest.result[index]),
            }),
          );
          resolve(documents);
        };
        tx.onerror = () => reject(tx.error);
      })
    : [];

  const uploads = hasUploadsStore
    ? await new Promise<StoredUpload[]>((resolve, reject) => {
        const tx = db.transaction(UPLOADS_STORE, "readonly");
        const store = tx.objectStore(UPLOADS_STORE);
        const getAllRequest = store.getAll();
        tx.oncomplete = () => resolve(getAllRequest.result as StoredUpload[]);
        tx.onerror = () => reject(tx.error);
      })
    : [];

  const serializedUploads = await Promise.all(
    uploads.map(async (upload) => ({
      id: upload.id,
      name: upload.name,
      type: upload.type,
      size: upload.size,
      createdAt: upload.createdAt,
      dataUrl: await blobToDataUrl(upload.data),
    })),
  );

  return {
    version: CURRENT_VERSION,
    exportedAt: Date.now(),
    documents: docs,
    uploads: serializedUploads,
  };
}

async function persistVault(): Promise<void> {
  requireUnlocked();
  const payload = {
    ...cachedVault!,
    exportedAt: Date.now(),
  };
  cachedVault = payload;
  const encrypted = await encryptPayload(sessionPassword!, payload);
  await writeVaultRecord(encrypted);
}

export async function initializeVault(
  password: string,
): Promise<ExportedNotesPayload> {
  sessionPassword = password;
  const existing = await readVaultRecord();
  if (existing) {
    try {
      const decrypted = await decryptPayload(password, existing);
      cachedVault = decrypted;
      return decrypted;
    } catch (error) {
      sessionPassword = null;
      cachedVault = null;
      throw error;
    }
  }

  const plaintext = await readPlaintextPayload();
  cachedVault =
    plaintext.documents.length > 0 || plaintext.uploads.length > 0
      ? plaintext
      : createEmptyPayload();
  await persistVault();
  await clearPlaintextStores();
  return cachedVault;
}

export async function restoreEncryptedVault(
  password: string,
  record: EncryptedVaultRecord,
): Promise<ExportedNotesPayload> {
  const decrypted = await decryptPayload(password, record);
  sessionPassword = password;
  cachedVault = decrypted;
  await writeVaultRecord(record);
  await clearPlaintextStores();
  return decrypted;
}

export async function getDocuments(): Promise<NoteDocument[]> {
  requireUnlocked();
  return cachedVault!.documents;
}

export async function addDocument(): Promise<NoteDocument> {
  requireUnlocked();
  const nextId =
    cachedVault!.documents.reduce((max, doc) => Math.max(max, doc.id), 0) + 1;
  const createdAt = Date.now();
  const doc: NoteDocument = {
    id: nextId,
    version: CURRENT_VERSION,
    title: DEFAULT_TITLE,
    createdAt: createdAt,
    content: undefined,
    tags: [],
  };
  cachedVault = {
    ...cachedVault!,
    documents: [doc, ...cachedVault!.documents],
  };
  await persistVault();
  return doc;
}

export async function updateDocument(
  id: number,
  doc: NoteDocument,
): Promise<void> {
  requireUnlocked();
  cachedVault = {
    ...cachedVault!,
    documents: cachedVault!.documents.map((stored) =>
      stored.id === id
        ? {
            ...stored,
            version: doc.version,
            title: doc.title,
            createdAt: doc.createdAt,
            content: doc.content,
            tags: doc.tags,
          }
        : stored,
    ),
  };
  await persistVault();
}

export async function deleteDocument(id: number): Promise<void> {
  requireUnlocked();
  cachedVault = {
    ...cachedVault!,
    documents: cachedVault!.documents.filter((doc) => doc.id !== id),
  };
  await persistVault();
}

export async function storeUploadAndGetUrl(file: File): Promise<string> {
  requireUnlocked();
  const dataUrl = await fileToDataUrl(file);
  const record: ExportedUpload = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: file.size,
    createdAt: Date.now(),
    dataUrl,
  };
  cachedVault = {
    ...cachedVault!,
    uploads: [record, ...cachedVault!.uploads],
  };
  await persistVault();
  return dataUrl;
}

export async function exportDatabase(): Promise<ExportedNotesPayload> {
  requireUnlocked();
  return {
    ...cachedVault!,
    exportedAt: Date.now(),
  };
}

export async function restoreDatabase(
  payload: ExportedNotesPayload,
): Promise<void> {
  requireUnlocked();
  cachedVault = payload;
  await persistVault();
}
