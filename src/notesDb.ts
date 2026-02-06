import type { PartialBlock } from "@blocknote/core";

const DB_NAME = "notes-db";
const DB_VERSION = 1;
const NOTES_STORE = "notes";
const UPLOADS_STORE = "uploads";

function openNotesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { autoIncrement: true });
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
  });
}

export async function addDocument(): Promise<NoteDocument> {
  const db = await openNotesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, "readwrite");
    const store = tx.objectStore(NOTES_STORE);
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
    const tx = db.transaction(NOTES_STORE, "readwrite");
    const store = tx.objectStore(NOTES_STORE);
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
    const tx = db.transaction(NOTES_STORE, "readwrite");
    const store = tx.objectStore(NOTES_STORE);
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

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Unable to decode upload data.");
  }
  return response.blob();
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

export async function exportDatabase(): Promise<ExportedNotesPayload> {
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

export async function restoreDatabase(
  payload: ExportedNotesPayload,
): Promise<void> {
  const uploads = await Promise.all(
    payload.uploads.map(async (upload) => ({
      id: upload.id,
      name: upload.name,
      type: upload.type,
      size: upload.size,
      createdAt: upload.createdAt,
      data: await dataUrlToBlob(upload.dataUrl),
    })),
  );

  const db = await openNotesDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([NOTES_STORE, UPLOADS_STORE], "readwrite");
    const notesStore = tx.objectStore(NOTES_STORE);
    const uploadsStore = tx.objectStore(UPLOADS_STORE);
    notesStore.clear();
    uploadsStore.clear();

    payload.documents.forEach((doc) => {
      notesStore.put(
        {
          version: doc.version,
          title: doc.title,
          createdAt: doc.createdAt,
          content: doc.content,
          tags: doc.tags,
        },
        doc.id,
      );
    });

    uploads.forEach((upload) => {
      uploadsStore.put(upload);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
