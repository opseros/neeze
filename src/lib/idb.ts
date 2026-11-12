'use client'

/**
 * Tiny IndexedDB wrapper (no dependency). Two stores:
 *  - saved:  provider snapshots the user saved, readable offline
 *  - outbox: requests waiting for the network, sent later with their idempotency key
 */
const DB_NAME = 'neeze'
const DB_VERSION = 1

export type SavedProvider = {
  id: number
  name: string
  nameBn?: string | null
  phone: string
  whatsapp?: string | null
  locality?: string
  categories?: string[]
  savedAt: number
}

export type OutboxItem = {
  idempotencyKey: string
  body: Record<string, unknown>
  providerName: string
  createdAt: number
  attempts: number
  lastError?: string
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('saved')) db.createObjectStore('saved', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'idempotencyKey' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(store: 'saved' | 'outbox', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const r = fn(t.objectStore(store))
    t.oncomplete = () => resolve(r.result)
    t.onerror = () => reject(t.error)
  })
}

export const savedStore = {
  all: () => tx<SavedProvider[]>('saved', 'readonly', (s) => s.getAll() as IDBRequest<SavedProvider[]>),
  get: (id: number) => tx<SavedProvider | undefined>('saved', 'readonly', (s) => s.get(id) as IDBRequest<SavedProvider | undefined>),
  put: (p: SavedProvider) => tx('saved', 'readwrite', (s) => s.put(p)),
  remove: (id: number) => tx('saved', 'readwrite', (s) => s.delete(id)),
}

export const outboxStore = {
  all: () => tx<OutboxItem[]>('outbox', 'readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>),
  put: (i: OutboxItem) => tx('outbox', 'readwrite', (s) => s.put(i)),
  remove: (key: string) => tx('outbox', 'readwrite', (s) => s.delete(key)),
}

export const OUTBOX_EVENT = 'neeze:outbox-changed'

/** Send one request. Returns the server result, or throws a network error so the caller can queue it. */
export async function submitRequest(body: Record<string, unknown>) {
  const res = await fetch('/api/requests/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data: data as { code?: string; error?: string; id?: number } }
}

let flushing = false
/** Retry queued requests. Called on load, on the `online` event and after sign-in. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let sent = 0
  try {
    for (const item of await outboxStore.all()) {
      try {
        const r = await submitRequest(item.body)
        if (r.ok) {
          await outboxStore.remove(item.idempotencyKey)
          sent++
        } else if (r.status === 401) {
          break // needs sign-in; keep everything queued
        } else if (r.status >= 400 && r.status < 500) {
          // Permanent problem (e.g. provider stopped accepting). Keep it visible with the error.
          await outboxStore.put({ ...item, attempts: item.attempts + 1, lastError: r.data.error ?? String(r.status) })
        }
      } catch {
        break // still offline
      }
    }
  } finally {
    flushing = false
    window.dispatchEvent(new Event(OUTBOX_EVENT))
  }
  return sent
}

export const newIdempotencyKey = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, '')
