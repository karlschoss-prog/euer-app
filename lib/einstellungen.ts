// Funktions-Schalter (Feature-Flags): schaltet optionale Module an/aus, damit die
// App auf das zugeschnitten ist, was der Betrieb tatsächlich braucht.
//
// Grundsätze:
//  · Default = ALLES an → bestehende Nutzer sehen keine Regression. Das Schlanke
//    entsteht über den Onboarding-Wizard bzw. die Einstellungen, nicht über
//    verstecktes Default-Aus.
//  · "Aus" blendet nur die UI aus; Daten bleiben erhalten (Wieder-Ein stellt her).
//  · Ein Schalter existiert nur für ein real vorhandenes Feature.
//
// Geltungsbereich aktuell GLOBAL. Die Helfer nehmen bereits ein optionales
// profilId entgegen, damit sich später pro-Profil-Overrides nachrüsten lassen,
// ohne die Aufrufer zu ändern.

export type FunktionsKey =
  | "inbox"
  | "rechnungen"
  | "kunden"
  | "mahnwesen"
  | "erechnungAusstellung"
  | "umsatzsteuer"
  | "pdfExport"

export type Funktionen = Record<FunktionsKey, boolean>

// Event, mit dem die Einstellungs-Seite den Onboarding-Wizard erneut öffnet.
export const ONBOARDING_EVENT = "euer:onboarding-start"

export const FUNKTION_DEFAULT: Funktionen = {
  inbox: true,
  rechnungen: true,
  kunden: true,
  mahnwesen: true,
  erechnungAusstellung: true,
  umsatzsteuer: true,
  pdfExport: true,
}

export interface FunktionsMeta {
  key: FunktionsKey
  label: string
  beschreibung: string
  haengtAb?: FunktionsKey   // Modul ist nur sinnvoll, wenn dieses Elternmodul an ist
}

// Reihenfolge = Anzeige in Einstellungen/Wizard. Elternmodule vor ihren Kindern.
export const FUNKTIONEN_META: FunktionsMeta[] = [
  { key: "rechnungen", label: "Rechnungen", beschreibung: "Rechnungen schreiben, als PDF ausgeben und den Zahlungsstatus verfolgen." },
  { key: "kunden", label: "Kundenverwaltung", beschreibung: "Kundenstamm mit Adressen für schnelleres Rechnungsschreiben.", haengtAb: "rechnungen" },
  { key: "mahnwesen", label: "Mahnwesen", beschreibung: "Zahlungserinnerungen und Mahnungen zu offenen Rechnungen.", haengtAb: "rechnungen" },
  { key: "erechnungAusstellung", label: "E-Rechnung ausstellen", beschreibung: "Rechnungen zusätzlich als XRechnung-XML und ZUGFeRD/Factur-X-PDF ausgeben (ab 2027/28 Pflicht).", haengtAb: "rechnungen" },
  { key: "inbox", label: "Beleg-Inbox & E-Rechnung-Empfang", beschreibung: "Belege reinziehen, E-Rechnungen automatisch auslesen und als Ausgabe buchen." },
  { key: "umsatzsteuer", label: "Umsatzsteuer-Voranmeldung", beschreibung: "UStVA-Auswertung je Steuersatz (nur bei Regelbesteuerung, nicht §19)." },
  { key: "pdfExport", label: "PDF-Monatsexport", beschreibung: "Monatsübersicht der Belege als druckfertiges PDF." },
]

const META_MAP = new Map(FUNKTIONEN_META.map((m) => [m.key, m]))

// Ist die Funktion wirksam aktiv? Berücksichtigt die Abhängigkeit vom Elternmodul.
// profilId ist derzeit ungenutzt (Platzhalter für spätere pro-Profil-Overrides).
export function istFunktionAktiv(funktionen: Funktionen, key: FunktionsKey, profilId?: string): boolean {
  void profilId
  const meta = META_MAP.get(key)
  if (meta?.haengtAb && !funktionen[meta.haengtAb]) return false
  return funktionen[key]
}

// Füllt einen (evtl. unvollständigen) gespeicherten Stand mit Defaults auf.
export function mitDefaults(teil: Partial<Funktionen> | null | undefined): Funktionen {
  return { ...FUNKTION_DEFAULT, ...(teil ?? {}) }
}
