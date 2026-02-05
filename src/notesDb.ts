import type { PartialBlock } from "@blocknote/core";

const DB_NAME = "notes-db";
const DB_VERSION = 1;
const STORE_NAME = "notes";

function openNotesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
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
