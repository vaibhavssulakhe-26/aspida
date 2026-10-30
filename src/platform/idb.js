// IndexedDB wrapper for feed entries.
//
// Store "entries", out-of-line array keys: [source, generation, kind, value]
//   kind = 'url' (feedUrlKey) | 'host'
// A refresh writes a new generation, flips the active generation in the
// feed status, then deletes the old generation with one key-range delete.
// If the worker dies mid-refresh the old generation stays active
// ("keep the last good copy").

const DB_NAME = 'aspida';
const DB_VERSION = 1;
const STORE = 'entries';

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withDb(fn) {
  const db = await openDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

// Write entries in chunks so a large feed doesn't build one huge transaction.
export async function putEntries(source, gen, kind, values, chunk = 20000) {
  await withDb(async (db) => {
    for (let i = 0; i < values.length; i += chunk) {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const v of values.slice(i, i + chunk)) store.put(1, [source, gen, kind, v]);
      await txDone(tx);
    }
  });
}

// Delete every generation of `source` except `keepGen` (or all if null).
export async function deleteGenerations(source, keepGen = null) {
  await withDb(async (db) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (keepGen === null) {
      store.delete(IDBKeyRange.bound([source], [source, []]));
    } else {
      store.delete(IDBKeyRange.bound([source, -Infinity], [source, keepGen], false, true));
      store.delete(IDBKeyRange.bound([source, keepGen, []], [source, []], true, false));
    }
    await txDone(tx);
  });
}

// keys: array of [source, gen, kind, value]. Returns the keys that exist.
export async function findExisting(keys) {
  if (!keys.length) return [];
  return withDb(async (db) => {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const found = await Promise.all(keys.map((k) => promisify(store.getKey(k))));
    return keys.filter((_, i) => found[i] !== undefined);
  });
}

export async function countEntries(source, gen) {
  return withDb((db) => {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    return promisify(store.count(IDBKeyRange.bound([source, gen], [source, gen, []])));
  });
}

export function deleteDatabase() {
  return promisify(indexedDB.deleteDatabase(DB_NAME));
}
