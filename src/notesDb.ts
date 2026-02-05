import type { PartialBlock } from "@blocknote/core";

const DB_NAME = "notes-db";
const DB_VERSION = 1;
const STORE_NAME = "notes";
const UPLOADS_STORE = "uploads";

function openNotesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
        db.createObjectStore(UPLOADS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const CURRENT_VERSION = 1;

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

export interface NoteDocument extends StoredDocument {
  id: number;
}

const DEFAULT_TITLE = "Untitled";

export async function getDocuments(): Promise<NoteDocument[]> {
  const db = await openNotesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
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
  });
}

export async function addDocument(): Promise<NoteDocument> {
  const db = await openNotesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const createdAt = Date.now();
    const doc = {
      version: CURRENT_VERSION,
      title: DEFAULT_TITLE,
      createdAt: createdAt,
      content: undefined,
      tags: [],
    };
    const addRequest = store.add(doc);

    tx.oncomplete = () => {
      resolve({
        ...doc,
        id: Number(addRequest.result),
      });
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateDocument(
  id: number,
  doc: NoteDocument,
): Promise<void> {
  const db = await openNotesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(
      {
        version: doc.version,
        title: doc.title,
        createdAt: doc.createdAt,
        content: doc.content,
        tags: doc.tags,
      },
      id,
    );

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await openNotesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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

export async function storeUploadAndGetUrl(file: File): Promise<string> {
  const db = await openNotesDb();
  const record: StoredUpload = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: file.size,
    createdAt: Date.now(),
    data: file,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(UPLOADS_STORE, "readwrite");
    const store = tx.objectStore(UPLOADS_STORE);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return fileToDataUrl(file);
}
