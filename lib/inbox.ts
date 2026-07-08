// Belege-Inbox: hierhin zieht der Nutzer Dateien (Foto/PDF/E-Rechnung-XML), die
// noch nicht gebucht sind. Bewusst ein EIGENER IndexedDB-Store (nicht der Anhang-
// Store), damit das Backup-Aufräumen (bereinigeVerwaisteAnhaenge) die noch nicht
// gebuchten Dateien nicht löscht. Beim Buchen wird die Datei in den Anhang-Store
// übernommen und das Inbox-Element entfernt.

import { ERechnungDaten } from "@/lib/erechnung"

export interface InboxItem {
  id: string
  name: string
  mime: string
  groesse: number
  erstellt_am: string          // ISO
  erechnung: ERechnungDaten | null  // Ergebnis des Auswertens; null = keine E-Rechnung
}

interface InboxRecord extends InboxItem {
  blob: Blob
}

const DB_NAME = "euer_inbox_db"
const STORE = "items"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function ladeInboxItems(): Promise<InboxItem[]> {
  try {
    const db = await openDB()
    const records: InboxRecord[] = await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll()
      req.onsuccess = () => resolve((req.result as InboxRecord[]) ?? [])
      req.onerror = () => resolve([])
    })
    return records
      .map(({ blob, ...meta }) => { void blob; return meta })
      .sort((a, b) => b.erstellt_am.localeCompare(a.erstellt_am))
  } catch {
    return []
  }
}

export async function speichereInboxRecord(item: InboxItem, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put({ ...item, blob })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Aktualisiert nur die Metadaten (z. B. nach dem Auswerten) und behält den Blob.
export async function aktualisiereInboxItem(item: InboxItem): Promise<void> {
  const blob = await ladeInboxBlob(item.id)
  if (!blob) return
  await speichereInboxRecord(item, blob)
}

export async function ladeInboxBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id)
      req.onsuccess = () => resolve(((req.result as InboxRecord | undefined)?.blob) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function loescheInboxItem(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // ignorieren
  }
}

export async function oeffneInboxItem(id: string, name?: string): Promise<boolean> {
  const blob = await ladeInboxBlob(id)
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const w = window.open(url, "_blank")
  if (!w) {
    const a = document.createElement("a")
    a.href = url
    a.download = name ?? "beleg"
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
