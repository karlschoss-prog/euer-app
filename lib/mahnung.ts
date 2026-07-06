import { Rechnung, Mahnung, MahnStufe } from "@/types/beleg"
import { rechnungSummen, addTage } from "@/lib/rechnung"
import { v4 as uuidv4 } from "uuid"

// Zentrale Konfiguration des Mahnlaufs. Reihenfolge = Eskalation.
// Die Fristen zählen ab dem Rechnungsdatum (das Zahlungsziel beträgt i. d. R.
// bereits 14 Tage, daher fällt die Zahlungserinnerung mit der Fälligkeit zusammen).
//
// Hinweis (fachlich): Prozentuale Mahnkosten sind rechtlich nicht der Standard —
// zulässig sind tatsächliche Mahnkosten + Verzugszinsen. Der 5-%-Aufschlag ist eine
// bewusste Vorgabe und lässt sich hier zentral anpassen.
export interface MahnStufeConfig {
  stufe: MahnStufe
  stufeNr: number
  label: string              // Anzeige-/Betreffname
  abTag: number              // ab wie vielen Tagen seit Rechnungsdatum fällig
  aufschlagProzent: number   // kumulierter Aufschlag auf den Bruttobetrag
  neueFristTage: number      // neue Zahlungsfrist ab Mahndatum
  betreff: string            // Betreffzeile im PDF
}

export const MAHN_STUFEN: MahnStufeConfig[] = [
  { stufe: "zahlungserinnerung", stufeNr: 0, label: "Zahlungserinnerung", abTag: 14, aufschlagProzent: 0, neueFristTage: 7, betreff: "Zahlungserinnerung" },
  { stufe: "mahnung_1", stufeNr: 1, label: "1. Mahnung", abTag: 30, aufschlagProzent: 5, neueFristTage: 7, betreff: "1. Mahnung" },
  { stufe: "mahnung_2", stufeNr: 2, label: "2. Mahnung", abTag: 45, aufschlagProzent: 10, neueFristTage: 7, betreff: "2. Mahnung" },
  { stufe: "mahnverfahren", stufeNr: 3, label: "Gerichtliches Mahnverfahren", abTag: 60, aufschlagProzent: 10, neueFristTage: 7, betreff: "Letzte Mahnung vor gerichtlichem Mahnverfahren" },
]

export function mahnStufeConfig(stufe: MahnStufe): MahnStufeConfig {
  const cfg = MAHN_STUFEN.find((s) => s.stufe === stufe)
  if (!cfg) throw new Error(`Unbekannte Mahnstufe: ${stufe}`)
  return cfg
}

// Ganze Kalendertage zwischen Rechnungsdatum (TT.MM.JJJJ) und heute.
export function tageSeitRechnung(rechnungsdatum: string, heute: Date = new Date()): number {
  const [d, m, y] = rechnungsdatum.split(".")
  const start = new Date(Number(y), Number(m) - 1, Number(d)).setHours(0, 0, 0, 0)
  const jetzt = new Date(heute).setHours(0, 0, 0, 0)
  return Math.floor((jetzt - start) / 86_400_000)
}

// Nächste noch nicht erstellte Stufe, deren Frist erreicht ist (streng sequenziell:
// es kann immer nur die auf die letzte erstellte Stufe folgende Stufe fällig werden).
// Gibt null zurück, wenn (noch) keine Stufe fällig ist oder der Lauf abgeschlossen ist.
export function naechsteFaelligeStufe(
  rechnung: Rechnung,
  bereitsErstellt: Mahnung[],
  heute: Date = new Date()
): MahnStufeConfig | null {
  const hoechsteNr = bereitsErstellt.length ? Math.max(...bereitsErstellt.map((m) => m.stufeNr)) : -1
  const naechste = MAHN_STUFEN.find((s) => s.stufeNr === hoechsteNr + 1)
  if (!naechste) return null
  return tageSeitRechnung(rechnung.rechnungsdatum, heute) >= naechste.abTag ? naechste : null
}

// Baut ein Mahnung-Objekt für die angegebene Stufe. Der offene Betrag ist der
// Bruttobetrag der Rechnung; der Aufschlag wird auf Cent gerundet.
export function berechneMahnung(rechnung: Rechnung, stufe: MahnStufe, mahndatum: string): Mahnung {
  const cfg = mahnStufeConfig(stufe)
  const brutto = rechnungSummen(rechnung.positionen, rechnung.kleinunternehmer).brutto
  const mahnkostenBetrag = Math.round(brutto * cfg.aufschlagProzent) / 100
  return {
    id: uuidv4(),
    rechnungId: rechnung.id,
    rechnungsnummer: rechnung.rechnungsnummer,
    profilId: rechnung.profilId,
    stufe,
    stufeNr: cfg.stufeNr,
    mahndatum,
    neuesZahlungsziel: addTage(mahndatum, cfg.neueFristTage),
    rechnungsbetrag: brutto,
    mahnkostenProzent: cfg.aufschlagProzent,
    mahnkostenBetrag,
    gesamtforderung: brutto + mahnkostenBetrag,
    erstellt_am: new Date().toISOString(),
  }
}
