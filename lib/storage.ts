import { Beleg, Vorlage, Unternehmensprofil, Kunde, Rechnung } from "@/types/beleg"
import { erstelleBelegeAusRechnung, trailingNumber } from "@/lib/rechnung"

const STORAGE_KEY = "euer_belege"
const VORLAGEN_KEY = "euer_vorlagen"
const SPERREN_KEY = "euer_gesperrte_monate"
const PROFILE_KEY = "euer_unternehmensprofile"
const KUNDEN_KEY = "euer_kunden"
const RECHNUNGEN_KEY = "euer_rechnungen"
const ANFANG_KEY = "euer_anfangsbestaende"

// Name des Events, das nach jeder Datenänderung gefeuert wird.
// Das Auto-Backup hört darauf und schreibt die Backup-Datei neu.
export const DATEN_GEAENDERT = "euer:daten-geaendert"

// Zentrale Schreibfunktion: speichert und signalisiert die Änderung.
// Backup-Zeitstempel laufen bewusst NICHT hierüber (würde eine Endlosschleife
// mit dem Auto-Backup auslösen).
function schreibe(key: string, wert: unknown): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(wert))
  window.dispatchEvent(new Event(DATEN_GEAENDERT))
}

// --- Belege ---

export function ladeBelege(): Beleg[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereBeleg(beleg: Beleg): void {
  schreibe(STORAGE_KEY, [...ladeBelege(), beleg])
}

export function loescheBeleg(id: string): void {
  schreibe(STORAGE_KEY, ladeBelege().filter((b) => b.id !== id))
}

export function aktualisiereBeleg(aktualisiert: Beleg): void {
  schreibe(STORAGE_KEY, ladeBelege().map((b) => (b.id === aktualisiert.id ? aktualisiert : b)))
}

export function speichereBelege(neue: Beleg[]): void {
  schreibe(STORAGE_KEY, [...ladeBelege(), ...neue])
}

export function loescheBelegeNachRechnung(rechnungId: string): void {
  schreibe(STORAGE_KEY, ladeBelege().filter((b) => b.rechnungId !== rechnungId))
}

export function exportiereBelege(): string {
  return JSON.stringify(
    {
      belege: ladeBelege(),
      vorlagen: ladeVorlagen(),
      unternehmensprofile: ladeProfile(),
      kunden: ladeKunden(),
      rechnungen: ladeRechnungen(),
      anfangsbestaende: ladeAnfangsbestaende(),
    },
    null,
    2
  )
}

// Löscht ALLE Daten (Belege, Vorlagen, Profile, Kunden, Rechnungen, Sperren).
// Backup-Datei-Verknüpfung und -Zeitstempel bleiben erhalten.
export function setzeAllesZurueck(): void {
  if (typeof window === "undefined") return
  ;[STORAGE_KEY, VORLAGEN_KEY, SPERREN_KEY, PROFILE_KEY, KUNDEN_KEY, RECHNUNGEN_KEY, ANFANG_KEY].forEach(
    (key) => localStorage.removeItem(key)
  )
  window.dispatchEvent(new Event(DATEN_GEAENDERT))
}

export function importiereDaten(json: string): void {
  const parsed = JSON.parse(json)
  if (parsed.belege) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.belege))
  if (parsed.vorlagen) localStorage.setItem(VORLAGEN_KEY, JSON.stringify(parsed.vorlagen))
  if (parsed.unternehmensprofile) localStorage.setItem(PROFILE_KEY, JSON.stringify(parsed.unternehmensprofile))
  if (parsed.kunden) localStorage.setItem(KUNDEN_KEY, JSON.stringify(parsed.kunden))
  if (parsed.rechnungen) localStorage.setItem(RECHNUNGEN_KEY, JSON.stringify(parsed.rechnungen))
  if (parsed.anfangsbestaende) localStorage.setItem(ANFANG_KEY, JSON.stringify(parsed.anfangsbestaende))
}

// --- Anfangskontostand pro Jahr ---
// Format: { "2026": 1234.56 }

export function ladeAnfangsbestaende(): Record<string, number> {
  if (typeof window === "undefined") return {}
  const raw = localStorage.getItem(ANFANG_KEY)
  return raw ? JSON.parse(raw) : {}
}

export function ladeAnfangsbestand(jahr: number): number {
  return ladeAnfangsbestaende()[String(jahr)] ?? 0
}

export function setzeAnfangsbestand(jahr: number, betrag: number): void {
  const alle = ladeAnfangsbestaende()
  alle[String(jahr)] = betrag
  schreibe(ANFANG_KEY, alle)
}

// --- Vorlagen ---

export function ladeVorlagen(): Vorlage[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(VORLAGEN_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereVorlage(vorlage: Vorlage): void {
  schreibe(VORLAGEN_KEY, [...ladeVorlagen(), vorlage])
}

export function loescheVorlage(id: string): void {
  schreibe(VORLAGEN_KEY, ladeVorlagen().filter((v) => v.id !== id))
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
    schreibe(SPERREN_KEY, [...liste, monatJahr])
  }
}

export function entsperreMonate(monatJahr: string): void {
  schreibe(SPERREN_KEY, ladeGesperrteMonate().filter((m) => m !== monatJahr))
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

// --- Unternehmensprofile ---

export function ladeProfile(): Unternehmensprofil[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(PROFILE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereProfil(profil: Unternehmensprofil): void {
  const profile = ladeProfile()
  // Nur ein Standardprofil zulassen
  if (profil.istStandard) profile.forEach((p) => { p.istStandard = false })
  const idx = profile.findIndex((p) => p.id === profil.id)
  if (idx >= 0) profile[idx] = profil
  else profile.push(profil)
  // Falls noch kein Standard existiert, erstes Profil zum Standard machen
  if (!profile.some((p) => p.istStandard) && profile.length > 0) profile[0].istStandard = true
  schreibe(PROFILE_KEY, profile)
}

export function loescheProfil(id: string): void {
  const profile = ladeProfile().filter((p) => p.id !== id)
  if (!profile.some((p) => p.istStandard) && profile.length > 0) profile[0].istStandard = true
  schreibe(PROFILE_KEY, profile)
}

export function ladeProfil(id: string): Unternehmensprofil | undefined {
  return ladeProfile().find((p) => p.id === id)
}

export function ladeStandardProfil(): Unternehmensprofil | undefined {
  const profile = ladeProfile()
  return profile.find((p) => p.istStandard) ?? profile[0]
}

// Erhöht den fortlaufenden Zähler eines Profils auf mindestens `mindestens`
export function erhoeheRechnungszaehler(profilId: string, mindestens: number): void {
  const profile = ladeProfile()
  const p = profile.find((x) => x.id === profilId)
  if (!p) return
  if (p.naechsteRechnungsnummer < mindestens) {
    p.naechsteRechnungsnummer = mindestens
    schreibe(PROFILE_KEY, profile)
  }
}

// --- Kunden ---

export function ladeKunden(): Kunde[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(KUNDEN_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereKunde(kunde: Kunde): void {
  const kunden = ladeKunden()
  const idx = kunden.findIndex((k) => k.id === kunde.id)
  if (idx >= 0) kunden[idx] = kunde
  else kunden.push(kunde)
  schreibe(KUNDEN_KEY, kunden)
}

export function loescheKunde(id: string): void {
  schreibe(KUNDEN_KEY, ladeKunden().filter((k) => k.id !== id))
}

export function ladeKunde(id: string): Kunde | undefined {
  return ladeKunden().find((k) => k.id === id)
}

// --- Rechnungen ---

export function ladeRechnungen(): Rechnung[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(RECHNUNGEN_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereRechnung(rechnung: Rechnung): void {
  const rechnungen = ladeRechnungen()
  const idx = rechnungen.findIndex((r) => r.id === rechnung.id)
  if (idx >= 0) rechnungen[idx] = rechnung
  else rechnungen.push(rechnung)
  schreibe(RECHNUNGEN_KEY, rechnungen)
}

export function loescheRechnung(id: string): void {
  schreibe(RECHNUNGEN_KEY, ladeRechnungen().filter((r) => r.id !== id))
  // verknüpfte Einnahme-Belege ebenfalls entfernen
  loescheBelegeNachRechnung(id)
}

export function ladeRechnung(id: string): Rechnung | undefined {
  return ladeRechnungen().find((r) => r.id === id)
}

// Speichert eine Rechnung und hält die EÜR synchron:
// Einnahme-Belege entstehen erst, wenn die Rechnung bezahlt ist (Zuflussprinzip).
// Wird beim Anlegen/Bearbeiten und beim Umschalten des Status verwendet.
export function speichereRechnungMitBelegen(rechnung: Rechnung): void {
  speichereRechnung(rechnung)
  loescheBelegeNachRechnung(rechnung.id)
  if (rechnung.status === "bezahlt") {
    speichereBelege(erstelleBelegeAusRechnung(rechnung))
  }
  // Fortlaufenden Zähler nachziehen, falls die Nummer manuell gesetzt wurde
  const n = trailingNumber(rechnung.rechnungsnummer)
  if (n !== null) erhoeheRechnungszaehler(rechnung.profilId, n + 1)
}
