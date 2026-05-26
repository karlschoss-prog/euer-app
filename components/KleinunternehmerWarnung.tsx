"use client"

import { formatEuro } from "@/lib/formatierung"

const GRENZE = 25000

interface Props {
  jahresEinnahmen: number
  jahr: number
}

export default function KleinunternehmerWarnung({ jahresEinnahmen, jahr }: Props) {
  const prozent = Math.min((jahresEinnahmen / GRENZE) * 100, 100)
  const rest = Math.max(GRENZE - jahresEinnahmen, 0)

  let farbe = "bg-green-500"
  let rahmen = "border-green-200 bg-green-50"
  let textfarbe = "text-green-800"
  let hinweis = `Noch ${formatEuro(rest)} bis zur Vorjahresgrenze (§19 UStG, ab 2025).`

  if (prozent >= 90) {
    farbe = "bg-red-500"
    rahmen = "border-red-300 bg-red-50"
    textfarbe = "text-red-800"
    hinweis = jahresEinnahmen >= GRENZE
      ? `Vorjahresgrenze von ${formatEuro(GRENZE)} überschritten — im Folgejahr kein Kleinunternehmer mehr!`
      : `Achtung: Nur noch ${formatEuro(rest)} bis zur Vorjahresgrenze!`
  } else if (prozent >= 70) {
    farbe = "bg-orange-400"
    rahmen = "border-orange-200 bg-orange-50"
    textfarbe = "text-orange-800"
    hinweis = `Noch ${formatEuro(rest)} bis zur Vorjahresgrenze (§19 UStG, ab 2025).`
  }

  return (
    <div className={`border rounded-lg p-4 ${rahmen}`}>
      <div className="flex justify-between items-baseline mb-2">
        <span className={`text-sm font-medium ${textfarbe}`}>
          Jahresumsatz {jahr} · Vorjahresgrenze §19 UStG: {formatEuro(GRENZE)}
        </span>
        <span className={`text-sm font-bold ${textfarbe}`}>
          {formatEuro(jahresEinnahmen)} · {prozent.toFixed(0)} %
        </span>
      </div>
      <div className="h-2.5 bg-white/60 rounded-full overflow-hidden border border-black/10">
        <div
          className={`h-full rounded-full transition-all ${farbe}`}
          style={{ width: `${prozent}%` }}
        />
      </div>
      <p className={`text-xs mt-2 ${textfarbe}`}>{hinweis}</p>
    </div>
  )
}
