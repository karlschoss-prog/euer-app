import { Rechnung, RechnungPosition, Unternehmensprofil, Beleg } from "@/types/beleg"
import { v4 as uuidv4 } from "uuid"

export interface MwstGruppe {
  satz: number
  netto: number
  steuer: number
}

export interface RechnungSummen {
  netto: number
  mwstGruppen: MwstGruppe[]
  steuerGesamt: number
  brutto: number
}

// Summiert die Positionen, gruppiert nach MwSt-Satz.
// Bei Kleinunternehmer (§19) wird keine Steuer ausgewiesen.
export function rechnungSummen(
  positionen: RechnungPosition[],
  kleinunternehmer: boolean
): RechnungSummen {
  const gruppenMap = new Map<number, MwstGruppe>()
  let netto = 0

  for (const p of positionen) {
    const posNetto = (p.menge || 0) * (p.einzelpreis || 0)
    netto += posNetto
    const satz = kleinunternehmer ? 0 : p.mwst_satz
    const g = gruppenMap.get(satz) ?? { satz, netto: 0, steuer: 0 }
    g.netto += posNetto
    g.steuer += kleinunternehmer ? 0 : posNetto * (satz / 100)
    gruppenMap.set(satz, g)
  }

  const mwstGruppen = [...gruppenMap.values()].sort((a, b) => a.satz - b.satz)
  const steuerGesamt = mwstGruppen.reduce((s, g) => s + g.steuer, 0)

  return { netto, mwstGruppen, steuerGesamt, brutto: netto + steuerGesamt }
}

// Erzeugt die formatierte nächste Rechnungsnummer eines Profils, z. B. "2026-001"
export function formatRechnungsnummer(profil: Unternehmensprofil): string {
  const nummer = String(profil.naechsteRechnungsnummer).padStart(
    profil.rechnungsnummerStellen || 1,
    "0"
  )
  return `${profil.rechnungsnummerPrefix ?? ""}${nummer}`
}

// Liest die abschließende Ganzzahl aus einer Rechnungsnummer (für den Zähler)
export function trailingNumber(rechnungsnummer: string): number | null {
  const match = rechnungsnummer.match(/(\d+)\s*$/)
  return match ? parseInt(match[1], 10) : null
}

// Addiert n Tage zu einem TT.MM.JJJJ-Datum und gibt TT.MM.JJJJ zurück
export function addTage(datumDe: string, tage: number): string {
  const [d, m, y] = datumDe.split(".")
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  date.setDate(date.getDate() + tage)
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  return `${dd}.${mm}.${date.getFullYear()}`
}

// Wandelt eine Rechnung in Einnahme-Belege für die EÜR um — einen je
// MwSt-Satz, damit EÜR (netto) und Umsatzsteuer-Voranmeldung korrekt bleiben.
export function erstelleBelegeAusRechnung(rechnung: Rechnung): Beleg[] {
  const { mwstGruppen } = rechnungSummen(rechnung.positionen, rechnung.kleinunternehmer)
  const mehrereGruppen = mwstGruppen.length > 1
  const jetzt = new Date().toISOString()
  const kundeName = rechnung.empfaenger.name

  return mwstGruppen
    .filter((g) => g.netto !== 0)
    .map((g) => {
      const netto = g.netto
      const beschreibung = mehrereGruppen
        ? `Rechnung ${rechnung.rechnungsnummer} (${g.satz} % MwSt)`
        : `Rechnung ${rechnung.rechnungsnummer}`
      return {
        id: uuidv4(),
        typ: "einnahme" as const,
        // EÜR nach Zuflussprinzip (§11 EStG): Einnahme zählt am Zahlungstag
        datum: rechnung.zahlungsdatum || rechnung.rechnungsdatum,
        belegnummer: rechnung.rechnungsnummer,
        kunde_lieferant: kundeName || undefined,
        leistungsbeschreibung: rechnung.betreff
          ? `${rechnung.betreff} — ${beschreibung}`
          : beschreibung,
        menge: 1,
        einzelpreis: netto,
        gesamtpreis: netto,
        mwst_satz: g.satz,
        nettobetrag: netto,
        bruttobetrag: netto + g.steuer,
        kategorie: "Rechnung",
        erstellt_am: jetzt,
        rechnungId: rechnung.id,
      }
    })
}
