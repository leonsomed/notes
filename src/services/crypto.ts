const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedVaultRecord {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
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

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>) {
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

export async function encryptPayload<T>(
  password: string,
  payload: T,
): Promise<EncryptedVaultRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return {
    version: 1,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertext),
  };
}

export async function decryptPayload<T>(
  password: string,
  record: EncryptedVaultRecord,
): Promise<T> {
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
  return JSON.parse(decoded) as T;
}

export const isValidEncryptedRecord = (
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
