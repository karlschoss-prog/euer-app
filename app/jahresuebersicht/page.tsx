"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ladeBelege, ladeGesperrteMonate, sperreMonate, entsperreMonate } from "@/lib/storage"
import { berechneJahresEuer, berechneUmsatzsteuer, berechneJahresVorsteuer } from "@/lib/berechnung"
import { formatEuro } from "@/lib/formatierung"
import { Beleg } from "@/types/beleg"

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

const GRENZE = 25000

function kumulativFarbe(kumuliert: number): string {
  if (kumuliert >= GRENZE) return "text-neg font-bold"
  if (kumuliert >= GRENZE * 0.9) return "text-neg font-semibold"
  if (kumuliert >= GRENZE * 0.7) return "text-warn font-semibold"
  return "text-ink-soft"
}

export default function JahresuebersichtPage() {
  const router = useRouter()
  const [jahr, setJahr] = useState(new Date().getFullYear())
  const [belege, setBelege] = useState<Beleg[]>([])
  const [gesperrteMonate, setGesperrteMonate] = useState<string[]>([])
  const [ustAufgeklappt, setUstAufgeklappt] = useState(false)

  function laden() {
    setBelege(ladeBelege())
    setGesperrteMonate(ladeGesperrteMonate())
  }

  useEffect(() => { laden() }, [])

  const monate = berechneJahresEuer(belege, jahr)
  const ustQuartale = berechneUmsatzsteuer(belege, jahr)
  const vorsteuer = berechneJahresVorsteuer(belege, jahr)

  let laufendeEinnahmen = 0
  const monateKumuliert = monate.map((m) => {
    laufendeEinnahmen += m.einnahmen
    return { ...m, kumuliert: laufendeEinnahmen }
  })

  const gesamt = monate.reduce(
    (acc, m) => ({
      einnahmen: acc.einnahmen + m.einnahmen,
      ausgaben: acc.ausgaben + m.ausgaben,
      ueberschuss: acc.ueberschuss + m.ueberschuss,
    }),
    { einnahmen: 0, ausgaben: 0, ueberschuss: 0 }
  )

  // Tempo-Forecast
  const aktuellerMonat = new Date().getMonth() + 1
  const monateAktuell = monate.filter((m) => m.monat <= aktuellerMonat && m.einnahmen > 0)
  const avgMonatlich = monateAktuell.length > 0 ? gesamt.einnahmen / monateAktuell.length : 0
  const verbleibend = GRENZE - gesamt.einnahmen
  let forecastText: string | null = null
  if (gesamt.einnahmen > 0 && gesamt.einnahmen < GRENZE && avgMonatlich > 0) {
    const monateZurGrenze = Math.ceil(verbleibend / avgMonatlich)
    const forecastMonat = aktuellerMonat + monateZurGrenze
    if (forecastMonat <= 12) {
      forecastText = `Bei aktuellem Tempo erreichst du die Grenze voraussichtlich im ${MONATE[forecastMonat - 1]}.`
    } else {
      forecastText = `Bei aktuellem Tempo bleibt die Grenze dieses Jahr sicher (${formatEuro(verbleibend)} verbleibend).`
    }
  } else if (gesamt.einnahmen >= GRENZE) {
    forecastText = null
  }

  function toggleSperre(monat: number) {
    const key = `${String(monat).padStart(2, "0")}.${jahr}`
    if (gesperrteMonate.includes(key)) {
      entsperreMonate(key)
    } else {
      sperreMonate(key)
    }
    setGesperrteMonate(ladeGesperrteMonate())
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jahresübersicht</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setJahr((j) => j - 1)} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2">‹</button>
          <span className="font-semibold text-lg w-16 text-center">{jahr}</span>
          <button onClick={() => setJahr((j) => j + 1)} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2">›</button>
        </div>
      </div>

      {/* Jahreskarten */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-pos-tint border border-pos-line rounded-xl p-5 shadow-sm">
          <p className="text-sm text-pos font-medium">Einnahmen {jahr}</p>
          <p className="text-2xl font-bold text-pos mt-1">{formatEuro(gesamt.einnahmen)}</p>
        </div>
        <div className="bg-neg-tint border border-neg-line rounded-xl p-5 shadow-sm">
          <p className="text-sm text-neg font-medium">Ausgaben {jahr}</p>
          <p className="text-2xl font-bold text-neg mt-1">{formatEuro(gesamt.ausgaben)}</p>
        </div>
        <div className={`border rounded-xl p-5 shadow-sm ${gesamt.ueberschuss >= 0 ? "bg-brand-tint border-line" : "bg-warn-tint border-warn-line"}`}>
          <p className={`text-sm font-medium ${gesamt.ueberschuss >= 0 ? "text-brand-ink" : "text-warn"}`}>Überschuss {jahr}</p>
          <p className={`text-2xl font-bold mt-1 ${gesamt.ueberschuss >= 0 ? "text-brand-ink" : "text-warn"}`}>{formatEuro(gesamt.ueberschuss)}</p>
        </div>
      </div>

      {/* Gezahlte MwSt auf Ausgaben (Vorsteuer) */}
      <div className="bg-surface border rounded-xl px-5 py-3 shadow-sm flex items-center justify-between">
        <span className="text-sm text-muted">Gezahlte MwSt auf Ausgaben (Vorsteuer) {jahr}</span>
        <span className="text-lg font-bold text-ink">{formatEuro(vorsteuer)}</span>
      </div>

      {/* Tempo-Forecast */}
      {forecastText && (
        <div className="bg-brand-tint border border-line rounded-xl px-5 py-3 text-sm text-brand-ink flex items-center gap-2">
          <span>📈</span>
          <span>{forecastText}</span>
        </div>
      )}

      {/* Monatstabelle */}
      <div className="bg-surface border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-surface-2 text-left">
              <th className="px-4 py-3 font-semibold">Monat</th>
              <th className="px-4 py-3 font-semibold text-right text-pos">Einnahmen</th>
              <th className="px-4 py-3 font-semibold text-right text-neg">Ausgaben</th>
              <th className="px-4 py-3 font-semibold text-right text-brand-ink">Überschuss</th>
              <th className="px-4 py-3 font-semibold text-right text-muted">
                Kumuliert
                <span className="block text-xs font-normal text-faint">§19 Grenze: {formatEuro(GRENZE)}</span>
              </th>
              <th className="px-4 py-3 text-center text-muted font-semibold text-xs">Abschluss</th>
            </tr>
          </thead>
          <tbody>
            {monateKumuliert.map((m) => {
              const hatDaten = m.einnahmen > 0 || m.ausgaben > 0
              const key = `${String(m.monat).padStart(2, "0")}.${jahr}`
              const gesperrt = gesperrteMonate.includes(key)
              const prozent = Math.min((m.kumuliert / GRENZE) * 100, 100)
              return (
                <tr
                  key={m.monat}
                  className={`border-t group ${hatDaten ? "hover:bg-brand-tint cursor-pointer" : "text-faint"}`}
                  onClick={() => hatDaten && router.push(`/export?monat=${m.monat}&jahr=${jahr}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={hatDaten ? "font-medium" : ""}>{MONATE[m.monat - 1]}</span>
                      {gesperrt && <span className="text-xs">🔒</span>}
                      {hatDaten && (
                        <span className="text-faint group-hover:text-brand transition-colors text-xs ml-1">→</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right ${hatDaten ? "text-pos font-medium" : ""}`}>
                    {hatDaten ? formatEuro(m.einnahmen) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right ${hatDaten && m.ausgaben > 0 ? "text-neg font-medium" : ""}`}>
                    {hatDaten ? formatEuro(m.ausgaben) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${!hatDaten ? "" : m.ueberschuss >= 0 ? "text-brand-ink" : "text-warn"}`}>
                    {hatDaten ? formatEuro(m.ueberschuss) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.kumuliert > 0 ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={kumulativFarbe(m.kumuliert)}>{formatEuro(m.kumuliert)}</span>
                        <div className="w-24 h-2.5 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.kumuliert >= GRENZE ? "bg-neg-tint0" : m.kumuliert >= GRENZE * 0.7 ? "bg-warn" : "bg-pos"}`}
                            style={{ width: `${prozent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {(hatDaten || gesperrt) && (
                      <button
                        onClick={() => toggleSperre(m.monat)}
                        className={`text-xs px-3 py-1 rounded-lg border font-medium transition-colors ${
                          gesperrt
                            ? "bg-surface-2 text-muted border-line hover:bg-line"
                            : "text-muted border-line hover:bg-surface-2 hover:border-line-strong"
                        }`}
                        title={gesperrt ? "Monat entsperren" : "Monat abschließen & sperren"}
                      >
                        {gesperrt ? "🔒 Gesperrt" : "Abschließen"}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-surface-2 font-bold">
              <td className="px-4 py-3">Gesamt {jahr}</td>
              <td className="px-4 py-3 text-right text-pos">{formatEuro(gesamt.einnahmen)}</td>
              <td className="px-4 py-3 text-right text-neg">{formatEuro(gesamt.ausgaben)}</td>
              <td className="px-4 py-3 text-right text-brand-ink">{formatEuro(gesamt.ueberschuss)}</td>
              <td /><td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* USt-Auswertung — kollabierbar */}
      <div className="bg-surface border rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setUstAufgeklappt((v) => !v)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-2 transition-colors"
        >
          <div>
            <span className="font-semibold text-sm">Umsatzsteuer-Auswertung {jahr}</span>
            <span className="ml-3 text-xs text-faint">Nur bei Regelbesteuerung relevant (nicht §19 UStG)</span>
          </div>
          <span className="text-faint text-sm">{ustAufgeklappt ? "▲" : "▼"}</span>
        </button>
        {ustAufgeklappt && (
          <div className="px-6 pb-5 border-t">
            <table className="w-full text-sm border-collapse mt-4">
              <thead>
                <tr className="bg-surface-2 text-left">
                  <th className="border px-3 py-2">Quartal</th>
                  <th className="border px-3 py-2 text-right">Vereinnahmte USt</th>
                  <th className="border px-3 py-2 text-right">Vorsteuer</th>
                  <th className="border px-3 py-2 text-right">Zahllast</th>
                </tr>
              </thead>
              <tbody>
                {ustQuartale.map((q) => (
                  <tr key={q.quartal} className="hover:bg-surface-2">
                    <td className="border px-3 py-2 font-medium">Q{q.quartal}</td>
                    <td className="border px-3 py-2 text-right text-pos">{formatEuro(q.ustEinnahmen)}</td>
                    <td className="border px-3 py-2 text-right text-neg">{formatEuro(q.vorsteuer)}</td>
                    <td className={`border px-3 py-2 text-right font-medium ${q.zahllast >= 0 ? "text-brand-ink" : "text-warn"}`}>
                      {formatEuro(q.zahllast)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 font-bold border-t-2 border-line">
                  <td className="border px-3 py-2">Gesamt</td>
                  <td className="border px-3 py-2 text-right text-pos">{formatEuro(ustQuartale.reduce((s, q) => s + q.ustEinnahmen, 0))}</td>
                  <td className="border px-3 py-2 text-right text-neg">{formatEuro(ustQuartale.reduce((s, q) => s + q.vorsteuer, 0))}</td>
                  <td className="border px-3 py-2 text-right text-brand-ink">{formatEuro(ustQuartale.reduce((s, q) => s + q.zahllast, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
