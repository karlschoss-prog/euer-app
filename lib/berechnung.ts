import { Beleg } from "@/types/beleg"

export function berechneMonatsEuer(belege: Beleg[], monat: number, jahr: number) {
  const gefiltert = belege.filter((b) => {
    const [, mon, j] = b.datum.split(".")
    return parseInt(mon) === monat && parseInt(j) === jahr
  })
  const einnahmen = gefiltert
    .filter((b) => b.typ === "einnahme")
    .reduce((s, b) => s + b.nettobetrag, 0)
  const ausgaben = gefiltert
    .filter((b) => b.typ === "ausgabe")
    .reduce((s, b) => s + b.nettobetrag, 0)
  return { einnahmen, ausgaben, ueberschuss: einnahmen - ausgaben }
}

export function berechneJahresEuer(belege: Beleg[], jahr: number) {
  return Array.from({ length: 12 }, (_, i) => ({
    monat: i + 1,
    ...berechneMonatsEuer(belege, i + 1, jahr),
  }))
}

export function berechneUmsatzsteuer(belege: Beleg[], jahr: number) {
  const quartalVon = (q: number) => (q - 1) * 3 + 1
  const quartalBis = (q: number) => q * 3

  return [1, 2, 3, 4].map((q) => {
    const qBelege = belege.filter((b) => {
      const [, mon, j] = b.datum.split(".")
      const m = parseInt(mon)
      return parseInt(j) === jahr && m >= quartalVon(q) && m <= quartalBis(q)
    })
    const ustEinnahmen = qBelege
      .filter((b) => b.typ === "einnahme")
      .reduce((s, b) => s + b.nettobetrag * b.mwst_satz / 100, 0)
    const vorsteuer = qBelege
      .filter((b) => b.typ === "ausgabe")
      .reduce((s, b) => s + b.nettobetrag * b.mwst_satz / 100, 0)
    return { quartal: q, ustEinnahmen, vorsteuer, zahllast: ustEinnahmen - vorsteuer }
  })
}

export function berechneJahresEinnahmen(belege: Beleg[], jahr: number): number {
  return belege
    .filter((b) => b.typ === "einnahme" && b.datum.split(".")[2] === String(jahr))
    .reduce((s, b) => s + b.nettobetrag, 0)
}

// Im Jahr auf Ausgaben gezahlte MwSt (Vorsteuer)
export function berechneJahresVorsteuer(belege: Beleg[], jahr: number): number {
  return belege
    .filter((b) => b.typ === "ausgabe" && b.datum.split(".")[2] === String(jahr))
    .reduce((s, b) => s + (b.nettobetrag * b.mwst_satz) / 100, 0)
}

// --- Umsatzsteuer-Voranmeldung (UStVA) ---
// Auswertung nach vereinnahmten Entgelten (Ist-Versteuerung, §20 UStG): die EÜR-
// Belege sind bereits nach Zufluss-/Abflusstag datiert, daher genügt die Filterung
// nach dem Belegdatum. Nur relevant bei Regelbesteuerung (nicht §19 UStG).

export type UstZeitraum = "monat" | "quartal" | "jahr"

// Eine Zeile der Auswertung (ein Voranmeldungszeitraum). Die Feldnamen tragen
// die amtlichen Kennziffern der UStVA, damit die Werte direkt in ELSTER passen:
//   Kz 81 = Umsätze 19 % (Bemessungsgrundlage netto), Steuer daraus
//   Kz 86 = Umsätze  7 % (Bemessungsgrundlage netto), Steuer daraus
//   Kz 35/36 = Umsätze zu anderen Steuersätzen (Bemessungsgrundlage + Steuer)
//   Kz 66 = abziehbare Vorsteuer
//   Kz 83 = verbleibende Vorauszahlung (Zahllast) bzw. Überschuss
export interface UstPeriode {
  label: string          // "Januar", "Q1", "2026"
  index: number          // 1..12 (Monat) · 1..4 (Quartal) · Jahr (Jahreszahl)
  kz81_netto: number
  kz81_steuer: number
  kz86_netto: number
  kz86_steuer: number
  kz35_netto: number     // andere Steuersätze > 0 (z. B. historische 16 %/5 %)
  kz36_steuer: number
  umsatzsteuer: number   // Summe der Ausgangssteuer (Kz 81+86+36)
  kz66_vorsteuer: number
  kz83_zahllast: number  // umsatzsteuer − vorsteuer (positiv = Zahllast)
}

function belegMonatJahr(b: Beleg): { monat: number; jahr: number } {
  const [, mm, jjjj] = b.datum.split(".")
  return { monat: parseInt(mm, 10), jahr: parseInt(jjjj, 10) }
}

// Wertet die Belege eines Bereichs (Monatsspanne) zu einer UStVA-Periode aus.
function periodeAusBelegen(
  belege: Beleg[],
  jahr: number,
  vonMonat: number,
  bisMonat: number,
  label: string,
  index: number
): UstPeriode {
  const p: UstPeriode = {
    label, index,
    kz81_netto: 0, kz81_steuer: 0,
    kz86_netto: 0, kz86_steuer: 0,
    kz35_netto: 0, kz36_steuer: 0,
    umsatzsteuer: 0, kz66_vorsteuer: 0, kz83_zahllast: 0,
  }

  for (const b of belege) {
    const { monat, jahr: bj } = belegMonatJahr(b)
    if (bj !== jahr || monat < vonMonat || monat > bisMonat) continue
    const steuer = (b.nettobetrag * b.mwst_satz) / 100

    if (b.typ === "einnahme") {
      if (b.mwst_satz === 19) { p.kz81_netto += b.nettobetrag; p.kz81_steuer += steuer }
      else if (b.mwst_satz === 7) { p.kz86_netto += b.nettobetrag; p.kz86_steuer += steuer }
      else if (b.mwst_satz > 0) { p.kz35_netto += b.nettobetrag; p.kz36_steuer += steuer }
      // mwst_satz === 0 → steuerfrei / §19, keine UStVA-Position
    } else {
      // Ausgabe → Vorsteuer, sofern MwSt ausgewiesen
      p.kz66_vorsteuer += steuer
    }
  }

  p.umsatzsteuer = p.kz81_steuer + p.kz86_steuer + p.kz36_steuer
  p.kz83_zahllast = p.umsatzsteuer - p.kz66_vorsteuer
  return p
}

const MONATE_KURZ = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

// Liefert je gewähltem Zeitraum die UStVA-Perioden eines Jahres
// (12 Monate, 4 Quartale oder 1 Jahr).
export function berechneUstVoranmeldung(
  belege: Beleg[],
  jahr: number,
  zeitraum: UstZeitraum
): UstPeriode[] {
  if (zeitraum === "monat") {
    return Array.from({ length: 12 }, (_, i) =>
      periodeAusBelegen(belege, jahr, i + 1, i + 1, MONATE_KURZ[i], i + 1)
    )
  }
  if (zeitraum === "quartal") {
    return [1, 2, 3, 4].map((q) =>
      periodeAusBelegen(belege, jahr, (q - 1) * 3 + 1, q * 3, `Q${q}`, q)
    )
  }
  return [periodeAusBelegen(belege, jahr, 1, 12, String(jahr), jahr)]
}

// Summiert mehrere Perioden zu einer Gesamtzeile (Jahressumme).
export function summiereUstPerioden(perioden: UstPeriode[], label = "Gesamt"): UstPeriode {
  return perioden.reduce<UstPeriode>(
    (acc, p) => ({
      label, index: 0,
      kz81_netto: acc.kz81_netto + p.kz81_netto,
      kz81_steuer: acc.kz81_steuer + p.kz81_steuer,
      kz86_netto: acc.kz86_netto + p.kz86_netto,
      kz86_steuer: acc.kz86_steuer + p.kz86_steuer,
      kz35_netto: acc.kz35_netto + p.kz35_netto,
      kz36_steuer: acc.kz36_steuer + p.kz36_steuer,
      umsatzsteuer: acc.umsatzsteuer + p.umsatzsteuer,
      kz66_vorsteuer: acc.kz66_vorsteuer + p.kz66_vorsteuer,
      kz83_zahllast: acc.kz83_zahllast + p.kz83_zahllast,
    }),
    {
      label, index: 0,
      kz81_netto: 0, kz81_steuer: 0, kz86_netto: 0, kz86_steuer: 0,
      kz35_netto: 0, kz36_steuer: 0, umsatzsteuer: 0, kz66_vorsteuer: 0, kz83_zahllast: 0,
    }
  )
}

// Aufteilung des Überschusses: 50% Rücklage (z. B. Steuern), 50% frei verfügbar.
// Slices ergeben zusammen die Gesamteinnahmen (Ausgaben + Rücklage + frei).
export function berechneFreiesKapital(einnahmen: number, ausgaben: number) {
  const ueberschuss = einnahmen - ausgaben
  const ruecklage = ueberschuss > 0 ? ueberschuss * 0.5 : 0
  const frei = ueberschuss > 0 ? ueberschuss * 0.5 : 0
  return { einnahmen, ausgaben, ueberschuss, ruecklage, frei }
}
