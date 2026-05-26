import { Beleg, Vorlage } from "@/types/beleg"

const STORAGE_KEY = "euer_belege"
const VORLAGEN_KEY = "euer_vorlagen"
const SPERREN_KEY = "euer_gesperrte_monate"

// --- Belege ---

export function ladeBelege(): Beleg[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereBeleg(beleg: Beleg): void {
  const belege = ladeBelege()
  belege.push(beleg)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(belege))
}

export function loescheBeleg(id: string): void {
  const belege = ladeBelege().filter((b) => b.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(belege))
}

export function aktualisiereBeleg(aktualisiert: Beleg): void {
  const belege = ladeBelege().map((b) => (b.id === aktualisiert.id ? aktualisiert : b))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(belege))
}

export function exportiereBelege(): string {
  return JSON.stringify({ belege: ladeBelege(), vorlagen: ladeVorlagen() }, null, 2)
}

export function importiereDaten(json: string): void {
  const parsed = JSON.parse(json)
  if (parsed.belege) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.belege))
  if (parsed.vorlagen) localStorage.setItem(VORLAGEN_KEY, JSON.stringify(parsed.vorlagen))
}

// --- Vorlagen ---

export function ladeVorlagen(): Vorlage[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(VORLAGEN_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereVorlage(vorlage: Vorlage): void {
  const vorlagen = ladeVorlagen()
  vorlagen.push(vorlage)
  localStorage.setItem(VORLAGEN_KEY, JSON.stringify(vorlagen))
}

export function loescheVorlage(id: string): void {
  const vorlagen = ladeVorlagen().filter((v) => v.id !== id)
  localStorage.setItem(VORLAGEN_KEY, JSON.stringify(vorlagen))
}

// --- Monatsabschluss ---
// Format: "05.2026"

export function ladeGesperrteMonate(): string[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(SPERREN_KEY)
  return raw ? JSON.parse(raw) : []
}

export function sperreMonate(monatJahr: string): void {
  const liste = ladeGesperrteMonate()
  if (!liste.includes(monatJahr)) {
    liste.push(monatJahr)
    localStorage.setItem(SPERREN_KEY, JSON.stringify(liste))
  }
}

export function entsperreMonate(monatJahr: string): void {
  const liste = ladeGesperrteMonate().filter((m) => m !== monatJahr)
  localStorage.setItem(SPERREN_KEY, JSON.stringify(liste))
}

export function istMonatGesperrt(monatJahr: string): boolean {
  return ladeGesperrteMonate().includes(monatJahr)
}

// --- Backup-Zeitstempel ---

const BACKUP_TS_KEY = "euer_letztes_backup"

export function speichereBackupZeitstempel(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BACKUP_TS_KEY, new Date().toISOString())
}

export function ladeBackupZeitstempel(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(BACKUP_TS_KEY)
}
