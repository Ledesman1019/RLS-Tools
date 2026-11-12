"use client";

/**
 * Almacenamiento local del celular (IndexedDB): catálogo, cola de operaciones
 * y preferencias. Sobrevive a cortes de señal y a cerrar la app.
 */
const DB_NAME = "rls-tools";
const VERSION = 1;

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

async function run<T>(store: "kv" | "queue", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const kvGet = <T>(key: string) => run<T | undefined>("kv", "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
export const kvSet = (key: string, value: unknown) => run("kv", "readwrite", (s) => s.put(value, key));
export const kvDelete = (key: string) => run("kv", "readwrite", (s) => s.delete(key));

export const queueAll = <T>() => run<T[]>("queue", "readonly", (s) => s.getAll() as IDBRequest<T[]>);
export const queuePut = (op: unknown) => run("queue", "readwrite", (s) => s.put(op));
export const queueDelete = (id: string) => run("queue", "readwrite", (s) => s.delete(id));

/** Borra todo lo guardado en el celular (al cerrar sesión). */
export async function clearAll() {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["kv", "queue"], "readwrite");
    tx.objectStore("kv").clear();
    tx.objectStore("queue").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
