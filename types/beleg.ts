export type BelegTyp = "einnahme" | "ausgabe"

// Metadaten eines Beleganhangs (Foto/PDF). Die Binärdatei selbst liegt nicht hier,
// sondern im IndexedDB-Blob-Store (lib/anhaenge.ts), adressiert über `id`. GoBD
// verlangt den Originalbeleg — daher werden Anhänge im Backup mitgesichert.
export interface Anhang {
  id: string              // UUID, zugleich Schlüssel im Blob-Store
  name: string            // ursprünglicher Dateiname
  mime: string            // z. B. "application/pdf", "image/jpeg"
  groesse: number         // Bytes
  erstellt_am: string     // ISO-Timestamp
  quelle?: "upload" | "e-rechnung" | "inbox"  // Herkunft (Doku/Inbox)
}

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
  anhaenge?: Anhang[]     // angehängte Belege (Foto/PDF), Binärdaten im Blob-Store
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

// --- Mahnwesen ---

// Eskalationsstufen einer Mahnung. Reihenfolge = Ablauf (streng sequenziell):
// Zahlungserinnerung → 1. Mahnung → 2. Mahnung → gerichtliches Mahnverfahren.
export type MahnStufe = "zahlungserinnerung" | "mahnung_1" | "mahnung_2" | "mahnverfahren"

// Eine erstellte Mahnung zu einer bereits versendeten Rechnung. Absender- und
// Empfängerdaten werden nicht dupliziert, sondern aus der referenzierten Rechnung
// gelesen (die trägt bereits einen immutablen Snapshot, §14 UStG / GoBD). Die
// berechneten Beträge werden hier als Snapshot des Mahnzeitpunkts festgehalten.
export interface Mahnung {
  id: string
  rechnungId: string
  rechnungsnummer: string       // Snapshot für Anzeige/Verlauf
  profilId: string
  stufe: MahnStufe
  stufeNr: number               // 0 = Erinnerung, 1 = 1. Mahnung, 2 = 2. Mahnung, 3 = Mahnverfahren
  mahndatum: string             // TT.MM.JJJJ
  neuesZahlungsziel: string     // TT.MM.JJJJ — neue Frist zur Zahlung
  rechnungsbetrag: number       // offener Bruttobetrag (Snapshot)
  mahnkostenProzent: number     // kumulierter Aufschlag: 0, 5 oder 10
  mahnkostenBetrag: number      // = rechnungsbetrag * mahnkostenProzent / 100
  gesamtforderung: number       // = rechnungsbetrag + mahnkostenBetrag
  erstellt_am: string           // ISO-Timestamp
}
