"use client"

import { Beleg } from "@/types/beleg"
import { berechneJahresEuer, berechneMonatsEuer } from "@/lib/berechnung"
import { formatEuro } from "@/lib/formatierung"

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

interface EuerUebersichtProps {
  belege: Beleg[]
  monat: number
  jahr: number
}

export default function EuerUebersicht({ belege, monat, jahr }: EuerUebersichtProps) {
  const monatsEuer = berechneMonatsEuer(belege, monat, jahr)
  const jahresEuer = berechneJahresEuer(belege, jahr)

  const jahresSumme = jahresEuer.reduce(
    (acc, m) => ({
      einnahmen: acc.einnahmen + m.einnahmen,
      ausgaben: acc.ausgaben + m.ausgaben,
      ueberschuss: acc.ueberschuss + m.ueberschuss,
    }),
    { einnahmen: 0, ausgaben: 0, ueberschuss: 0 }
  )

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Monatsübersicht — {MONATE[monat - 1]} {jahr}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-pos-tint border border-pos-line rounded-xl p-4">
            <p className="text-sm text-pos">Einnahmen</p>
            <p className="text-xl font-bold text-pos tnum">{formatEuro(monatsEuer.einnahmen)}</p>
          </div>
          <div className="bg-neg-tint border border-neg-line rounded-xl p-4">
            <p className="text-sm text-neg">Ausgaben</p>
            <p className="text-xl font-bold text-neg tnum">{formatEuro(monatsEuer.ausgaben)}</p>
          </div>
          <div className="bg-brand-tint border border-line rounded-xl p-4">
            <p className="text-sm text-brand-ink">Überschuss</p>
            <p className="text-xl font-bold text-brand-ink tnum">{formatEuro(monatsEuer.ueberschuss)}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Jahresübersicht {jahr}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-2 text-left text-muted">
                <th className="border border-line px-3 py-2">Monat</th>
                <th className="border border-line px-3 py-2 text-right">Einnahmen</th>
                <th className="border border-line px-3 py-2 text-right">Ausgaben</th>
                <th className="border border-line px-3 py-2 text-right">Überschuss</th>
              </tr>
            </thead>
            <tbody>
              {jahresEuer.map((m) => (
                <tr
                  key={m.monat}
                  className={m.monat === monat ? "bg-brand-tint font-medium" : "hover:bg-surface-2"}
                >
                  <td className="border border-line px-3 py-2">{MONATE[m.monat - 1]}</td>
                  <td className="border border-line px-3 py-2 text-right tnum">{formatEuro(m.einnahmen)}</td>
                  <td className="border border-line px-3 py-2 text-right tnum">{formatEuro(m.ausgaben)}</td>
                  <td className="border border-line px-3 py-2 text-right tnum">{formatEuro(m.ueberschuss)}</td>
                </tr>
              ))}
              <tr className="bg-surface-2 font-bold text-ink">
                <td className="border border-line px-3 py-2">Gesamt</td>
                <td className="border border-line px-3 py-2 text-right tnum">{formatEuro(jahresSumme.einnahmen)}</td>
                <td className="border border-line px-3 py-2 text-right tnum">{formatEuro(jahresSumme.ausgaben)}</td>
                <td className="border border-line px-3 py-2 text-right tnum">{formatEuro(jahresSumme.ueberschuss)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
