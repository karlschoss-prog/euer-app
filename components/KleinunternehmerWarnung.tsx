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

  let farbe = "bg-pos"
  let rahmen = "border-pos-line bg-pos-tint"
  let textfarbe = "text-pos"
  let hinweis = `Noch ${formatEuro(rest)} bis zur Vorjahresgrenze (§19 UStG, ab 2025).`

  if (prozent >= 90) {
    farbe = "bg-neg"
    rahmen = "border-neg-line bg-neg-tint"
    textfarbe = "text-neg"
    hinweis = jahresEinnahmen >= GRENZE
      ? `Vorjahresgrenze von ${formatEuro(GRENZE)} überschritten — im Folgejahr kein Kleinunternehmer mehr!`
      : `Achtung: Nur noch ${formatEuro(rest)} bis zur Vorjahresgrenze!`
  } else if (prozent >= 70) {
    farbe = "bg-warn"
    rahmen = "border-warn-line bg-warn-tint"
    textfarbe = "text-warn"
    hinweis = `Noch ${formatEuro(rest)} bis zur Vorjahresgrenze (§19 UStG, ab 2025).`
  }

  return (
    <div className={`border rounded-xl p-4 ${rahmen}`}>
      <div className="flex justify-between items-baseline mb-2 gap-3 flex-wrap">
        <span className={`text-sm font-medium ${textfarbe}`}>
          Jahresumsatz {jahr} · Vorjahresgrenze §19 UStG: {formatEuro(GRENZE)}
        </span>
        <span className={`text-sm font-bold tnum ${textfarbe}`}>
          {formatEuro(jahresEinnahmen)} · {prozent.toFixed(0)} %
        </span>
      </div>
      <div className="h-2.5 bg-ink/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${farbe}`}
          style={{ width: `${prozent}%` }}
        />
      </div>
      <p className={`text-xs mt-2 ${textfarbe}`}>{hinweis}</p>
    </div>
  )
}
