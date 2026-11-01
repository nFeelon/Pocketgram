/** IndexedDB media cache — blobs persist between sessions, evicted oldest-first at CAP.
 *  navigator.storage.estimate() lies on Cloud Phone → bytes are tracked manually. */
const DB = 'pg-media-cache'
const STORE = 'media'
const CAP_BYTES = 40 * 1024 * 1024

interface CacheEntry {
  key: string
  blob: Blob
  ts: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// one connection per app lifetime — opening per op leaks connections until GC
const dbp = open()

function tx<R>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<R>): Promise<R> {
  return dbp.then(
    (db) =>
      new Promise<R>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        t.onerror = () => reject(t.error)
      }),
  )
}

const getEntry = (key: string) => tx<CacheEntry | undefined>('readonly', (s) => s.get(key))

export async function getCachedBlob(key: string | null): Promise<Blob | undefined> {
  if (!key) return undefined
  // a wedged IDB (never settles) must not stall the download — race it out
  const hit = await Promise.race([
    getEntry(key),
    new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500)),
  ]).catch(() => undefined)
  return hit?.blob
}

export function putCachedBlob(key: string | null, blob: Blob): void {
  if (key) void putEntry(key, blob).catch(console.error)
}

/** Read-through: cached blob by uniqueFileId, or fetch() → store → evict if over CAP */
export async function cachedBlob(key: string | null, fetch: () => Promise<Blob>): Promise<Blob> {
  const hit = await getCachedBlob(key)
  if (hit) return hit
  const blob = await fetch()
  putCachedBlob(key, blob)
  return blob
}

async function putEntry(key: string, blob: Blob) {
  await tx('readwrite', (s) => s.put({ key, blob, ts: Date.now() }))
  const { bytes } = await cacheStats().catch(() => ({ count: 0, bytes: 0 }))
  if (bytes <= CAP_BYTES) return
  // evict oldest until under the cap — cursor walks keys in order, ts decides age
  const db = await dbp
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const entries: { key: string; ts: number }[] = []
    t.objectStore(STORE).openCursor().onsuccess = (e) => {
      const cur = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (cur) {
        entries.push({ key: cur.key as string, ts: (cur.value as CacheEntry).ts })
        cur.continue()
      } else {
        const del = entries
          .sort((a, b) => a.ts - b.ts)
          .slice(0, Math.ceil(entries.length / 4)) // drop the oldest quarter at once
        del.forEach((x) => t.objectStore(STORE).delete(x.key))
        resolve()
      }
    }
    t.onerror = () => reject(t.error)
  })
}

export async function cacheStats(): Promise<{ count: number; bytes: number }> {
  const db = await dbp
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    let count = 0
    let bytes = 0
    t.objectStore(STORE).openCursor().onsuccess = (e) => {
      const cur = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (cur) {
        count++
        bytes += (cur.value as CacheEntry).blob.size
        cur.continue()
      } else resolve({ count, bytes })
    }
    t.onerror = () => reject(t.error)
  })
}

export async function clearMediaCache(): Promise<void> {
  const db = await dbp
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).clear()
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}
