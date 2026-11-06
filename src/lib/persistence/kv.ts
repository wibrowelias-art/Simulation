/** Minimal async key-value interface backed by IndexedDB (browser) or memory (SSR/tests). */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

export function memoryKV(seed: Record<string, unknown> = {}): KV & { dump(): Record<string, unknown> } {
  const m = new Map<string, unknown>(Object.entries(seed));
  return {
    async get<T>(k: string) {
      return m.has(k) ? (structuredClone(m.get(k)) as T) : undefined;
    },
    async set<T>(k: string, v: T) {
      m.set(k, structuredClone(v));
    },
    async del(k: string) {
      m.delete(k);
    },
    dump: () => Object.fromEntries(m),
  };
}

export function indexedDbKV(dbName = "god-sim", storeName = "kv", idb: IDBFactory | undefined = globalThis.indexedDB): KV {
  if (!idb) return memoryKV();
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () => {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = idb.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
        };
        req.onsuccess = () => {
          const db = req.result;
          // another page (a newer build, or a tool rewriting the save) wants the database: let go instead of
          // blocking it; the next call simply reopens
          db.onversionchange = () => { db.close(); dbp = null; };
          db.onclose = () => { dbp = null; };
          resolve(db);
        };
        req.onerror = () => { dbp = null; reject(req.error); };
        req.onblocked = () => { /* an older connection is closing; onsuccess follows */ };
      });
    }
    return dbp;
  };
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> => {
    let db = await open();
    let t: IDBTransaction;
    try { t = db.transaction(storeName, mode); }
    catch { dbp = null; db = await open(); t = db.transaction(storeName, mode); } // connection was closed under us
    return new Promise<T>((resolve, reject) => {
      const store = t.objectStore(storeName);
      const req = fn(store);
      t.oncomplete = () => resolve((req ? req.result : undefined) as T);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  return {
    get: <T>(k: string) => tx<T | undefined>("readonly", (s) => s.get(k)),
    set: async <T>(k: string, v: T) => {
      await tx("readwrite", (s) => s.put(v, k));
    },
    del: async (k: string) => {
      await tx("readwrite", (s) => s.delete(k));
    },
  };
}
