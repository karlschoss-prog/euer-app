export type BelegTyp = "einnahme" | "ausgabe"

export interface Beleg {
  id: string
  typ: BelegTyp
  datum: string           // TT.MM.JJJJ
  belegnummer?: string
  kunde_lieferant?: string
  leistungsbeschreibung: string
  menge: number
  einzelpreis: number
  gesamtpreis: number
  mwst_satz: number
  nettobetrag: number
  bruttobetrag: number
  kategorie?: string
  erstellt_am: string
  rechnungId?: string     // gesetzt, wenn aus einer Rechnung erzeugt
}

export interface Vorlage {
  id: string
  name: string
  typ: BelegTyp
  leistungsbeschreibung: string
  kunde_lieferant?: string
  menge: number
  einzelpreis: number
  mwst_satz: number
  kategorie?: string
}

// --- Rechnungswesen ---

// Unternehmensprofil = ein "Absender" (du hast mehrere Firmen).
// Enthält alle Pflichtangaben des leistenden Unternehmers (§14 UStG)
// sowie den fortlaufenden Rechnungsnummern-Zähler dieser Firma.
export interface Unternehmensprofil {
  id: string
  name: string                  // interne Bezeichnung, z. B. "Coaching"
  firmenname: string
  inhaber?: string
  strasse?: string
  plz?: string
  ort?: string
  land?: string
  steuernummer?: string
  ustIdNr?: string
  kleinunternehmer: boolean     // §19 UStG — keine MwSt ausweisen
  email?: string
  telefon?: string
  website?: string
  iban?: string
  bic?: string
  bank?: string
  kontoinhaber?: string
  logo?: string                 // data-URL (base64), wird im Backup mitgesichert
  design?: RechnungDesign       // optisches Layout des PDFs
  akzentfarbe?: string          // Hex, z. B. "#2563eb"
  zahlungszielTage: number
  rechnungsnummerPrefix: string // z. B. "2026-"
  rechnungsnummerStellen: number // Nullstellen, z. B. 3 -> 001
  naechsteRechnungsnummer: number // fortlaufender Zähler
  einleitungstext?: string
  fusstext?: string
  istStandard?: boolean
  erstellt_am: string
}

export interface Kunde {
  id: string
  name: string
  ansprechpartner?: string
  strasse?: string
  plz?: string
  ort?: string
  land?: string
  email?: string
  ustIdNr?: string
  notiz?: string
  erstellt_am: string
}

export interface RechnungPosition {
  beschreibung: string
  menge: number
  einzelpreis: number           // netto
  mwst_satz: number
  leistungsdatum?: string       // TT.MM.JJJJ, optional pro Position
}

export type RechnungDesign = "klassisch" | "kreativ" | "elegant" | "ks-rec"

// Snapshot der Absenderdaten zum Ausstellungszeitpunkt (GoBD: einmal
// ausgestellte Rechnungen dürfen sich nicht nachträglich ändern).
export interface AbsenderSnapshot {
  firmenname: string
  inhaber?: string
  strasse?: string
  plz?: string
  ort?: string
  land?: string
  email?: string
  telefon?: string
  website?: string
  steuernummer?: string
  ustIdNr?: string
  iban?: string
  bic?: string
  bank?: string
  kontoinhaber?: string
  logo?: string
  design?: RechnungDesign
  akzentfarbe?: string
  kleinunternehmer: boolean
}

export interface EmpfaengerSnapshot {
  name: string
  ansprechpartner?: string
  strasse?: string
  plz?: string
  ort?: string
  land?: string
  ustIdNr?: string
}

export type RechnungStatus = "offen" | "bezahlt"

export interface Rechnung {
  id: string
  rechnungsnummer: string
  profilId: string
  absender: AbsenderSnapshot
  kundeId?: string
  empfaenger: EmpfaengerSnapshot
  rechnungsdatum: string        // TT.MM.JJJJ
  zahlungsdatum?: string        // TT.MM.JJJJ — Zuflusstag, erst dann EÜR-Einnahme
  leistungsdatum?: string       // Datum oder Zeitraum (Freitext)
  positionen: RechnungPosition[]
  zahlungszielTage: number
  betreff?: string
  einleitungstext?: string
  fusstext?: string
  kleinunternehmer: boolean     // Snapshot des §19-Status
  status: RechnungStatus
  erstellt_am: string
}
