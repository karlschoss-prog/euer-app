"use client"

import { formatEuro } from "@/lib/formatierung"

interface Props {
  einnahmen: number
  ausgaben: number
  ruecklage: number
  frei: number
}

const FARBEN = {
  ausgaben: "#ef4444", // rot
  ruecklage: "#f59e0b", // amber
  frei: "#22c55e", // grün
}

export default function FreiesKapitalChart({ einnahmen, ausgaben, ruecklage, frei }: Props) {
  const total = einnahmen
  const r = 50
  const C = 2 * Math.PI * r

  const slices = [
    { label: "Ausgaben", value: Math.max(ausgaben, 0), color: FARBEN.ausgaben },
    { label: "Rücklage (50%)", value: ruecklage, color: FARBEN.ruecklage },
    { label: "Freies Kapital", value: frei, color: FARBEN.frei },
  ].filter((s) => s.value > 0)

  let offset = 0

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div className="relative shrink-0">
        <svg viewBox="0 0 120 120" className="w-44 h-44 -rotate-90">
          {total > 0 ? (
            slices.map((s) => {
              const len = (s.value / total) * C
              const el = (
                <circle
                  key={s.label}
                  cx={60}
                  cy={60}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={18}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += len
              return el
            })
          ) : (
            <circle cx={60} cy={60} r={r} fill="none" stroke="#e5e7eb" strokeWidth={18} />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">Frei</span>
          <span className="text-base font-bold text-green-600">{formatEuro(frei)}</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2 text-sm">
        <Zeile farbe={FARBEN.ausgaben} label="Ausgaben" wert={ausgaben} />
        <Zeile farbe={FARBEN.ruecklage} label="Rücklage (50% des Überschusses)" wert={ruecklage} />
        <Zeile farbe={FARBEN.frei} label="Freies Kapital" wert={frei} fett />
        <div className="border-t border-dashed pt-2 mt-2 space-y-1 text-xs text-gray-500">
          <div className="flex justify-between"><span>Gesamteinnahmen</span><span>{formatEuro(einnahmen)}</span></div>
          <div className="flex justify-between"><span>abzgl. Ausgaben</span><span>{formatEuro(einnahmen - ausgaben)}</span></div>
          <div className="flex justify-between font-medium text-gray-700"><span>abzgl. 50% Rücklage = freies Kapital</span><span>{formatEuro(frei)}</span></div>
        </div>
      </div>
    </div>
  )
}

function Zeile({ farbe, label, wert, fett = false }: { farbe: string; label: string; wert: number; fett?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-gray-600">
        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: farbe }} />
        {label}
      </span>
      <span className={fett ? "font-bold text-gray-900" : "font-medium text-gray-700"}>{formatEuro(wert)}</span>
    </div>
  )
}
