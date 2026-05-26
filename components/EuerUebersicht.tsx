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
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm text-green-700">Einnahmen</p>
            <p className="text-xl font-bold text-green-800">{formatEuro(monatsEuer.einnahmen)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-red-700">Ausgaben</p>
            <p className="text-xl font-bold text-red-800">{formatEuro(monatsEuer.ausgaben)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-700">Überschuss</p>
            <p className="text-xl font-bold text-blue-800">{formatEuro(monatsEuer.ueberschuss)}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Jahresübersicht {jahr}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border px-3 py-2">Monat</th>
                <th className="border px-3 py-2 text-right">Einnahmen</th>
                <th className="border px-3 py-2 text-right">Ausgaben</th>
                <th className="border px-3 py-2 text-right">Überschuss</th>
              </tr>
            </thead>
            <tbody>
              {jahresEuer.map((m) => (
                <tr
                  key={m.monat}
                  className={m.monat === monat ? "bg-blue-50 font-medium" : "hover:bg-gray-50"}
                >
                  <td className="border px-3 py-2">{MONATE[m.monat - 1]}</td>
                  <td className="border px-3 py-2 text-right">{formatEuro(m.einnahmen)}</td>
                  <td className="border px-3 py-2 text-right">{formatEuro(m.ausgaben)}</td>
                  <td className="border px-3 py-2 text-right">{formatEuro(m.ueberschuss)}</td>
                </tr>
              ))}
              <tr className="bg-gray-200 font-bold">
                <td className="border px-3 py-2">Gesamt</td>
                <td className="border px-3 py-2 text-right">{formatEuro(jahresSumme.einnahmen)}</td>
                <td className="border px-3 py-2 text-right">{formatEuro(jahresSumme.ausgaben)}</td>
                <td className="border px-3 py-2 text-right">{formatEuro(jahresSumme.ueberschuss)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
