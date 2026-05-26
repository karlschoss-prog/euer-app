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
