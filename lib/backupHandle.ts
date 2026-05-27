// Stores a FileSystemFileHandle in IndexedDB so it survives page reloads.
// localStorage cannot hold FileSystemFileHandle objects.

const DB_NAME = "euer_backup_db"
const STORE = "handles"
const HANDLE_KEY = "backup_file_handle"
const TS_KEY = "euer_auto_backup_ts"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getBackupHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(HANDLE_KEY)
      req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setBackupHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearBackupHandle(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export function speichereAutoBackupZeitstempel(): void {
  localStorage.setItem(TS_KEY, new Date().toISOString())
}

export function ladeAutoBackupZeitstempel(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TS_KEY) : null
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window
}
