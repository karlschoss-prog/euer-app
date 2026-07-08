// Speichert Beleganhänge (Foto/PDF) als Blobs in IndexedDB. LocalStorage kommt
// dafür nicht in Frage (Größenlimit, nur Strings). Die Metadaten (Name, MIME,
// Größe) liegen am Beleg selbst (types/beleg.ts, Feld `anhaenge`); hier liegt nur
// die Binärdatei, adressiert über die Anhang-id.

const DB_NAME = "euer_anhaenge_db"
const STORE = "blobs"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function speichereAnhangBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function ladeAnhangBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id)
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function loescheAnhangBlob(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Store existiert evtl. noch nicht — ignorieren
  }
}

// Alle gespeicherten Blob-Schlüssel (für Backup-Export und Aufräumen).
export async function alleAnhangIds(): Promise<string[]> {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).getAllKeys()
      req.onsuccess = () => resolve((req.result as string[]) ?? [])
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

// Leert den gesamten Blob-Store (bei komplettem Reset oder vor Backup-Import).
export async function leereAnhangStore(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Store existiert evtl. noch nicht — ignorieren
  }
}

// Entfernt Blobs, die von keinem Beleg mehr referenziert werden (verwaiste Anhänge).
export async function bereinigeVerwaisteAnhaenge(referenzierteIds: Set<string>): Promise<void> {
  const vorhanden = await alleAnhangIds()
  await Promise.all(
    vorhanden.filter((id) => !referenzierteIds.has(id)).map((id) => loescheAnhangBlob(id))
  )
}

// --- base64-Umwandlung fürs Backup (JSON kann keine Blobs enthalten) ---

export function blobZuDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function dataUrlZuBlob(dataUrl: string): Blob {
  const [kopf, daten] = dataUrl.split(",")
  const mime = kopf.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream"
  const bin = atob(daten)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// Öffnet einen Anhang in einem neuen Tab (Bild/PDF wird inline angezeigt).
export async function oeffneAnhang(id: string, name?: string): Promise<boolean> {
  const blob = await ladeAnhangBlob(id)
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const w = window.open(url, "_blank")
  if (!w) {
    // Popup blockiert → als Download anbieten
    const a = document.createElement("a")
    a.href = url
    a.download = name ?? "beleg"
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
