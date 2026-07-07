"use client"

import { useState } from "react"
import { Beleg } from "@/types/beleg"
import { formatEuro } from "@/lib/formatierung"

interface BelegTabelleProps {
  belege: Beleg[]
  onLoeschen?: (id: string) => void
  onBearbeiten?: (beleg: Beleg) => void
  onVorlage?: (beleg: Beleg) => void
  gesperrteMonate?: string[]
}

function getMonatJahr(beleg: Beleg): string {
  const teile = beleg.datum.split(".")
  return `${teile[1]}.${teile[2]}`
}

export default function BelegTabelle({
  belege,
  onLoeschen,
  onBearbeiten,
  onVorlage,
  gesperrteMonate = [],
}: BelegTabelleProps) {
  const [suche, setSuche] = useState("")

  const gefiltert = belege
    .filter((b) => {
      if (!suche) return true
      const q = suche.toLowerCase()
      return (
        b.datum.includes(q) ||
        b.leistungsbeschreibung.toLowerCase().includes(q) ||
        (b.kunde_lieferant ?? "").toLowerCase().includes(q) ||
        (b.belegnummer ?? "").toLowerCase().includes(q) ||
        (b.kategorie ?? "").toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const [dA, mA, jA] = a.datum.split(".")
      const [dB, mB, jB] = b.datum.split(".")
      return (
        new Date(`${jA}-${mA}-${dA}`).getTime() -
        new Date(`${jB}-${mB}-${dB}`).getTime()
      )
    })

  const hatAktionen = onLoeschen || onBearbeiten || onVorlage

  return (
    <div className="space-y-3">
      {belege.length > 3 && (
        <input
          type="text"
          placeholder="Suchen nach Datum, Beschreibung, Kunde…"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
        />
      )}

      {gefiltert.length === 0 ? (
        <p className="text-muted text-sm">
          {suche ? "Keine Einträge für diese Suche." : "Keine Einträge vorhanden."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-2 text-left text-muted">
                <th className="border border-line px-3 py-2">Datum</th>
                <th className="border border-line px-3 py-2">Beleg-Nr.</th>
                <th className="border border-line px-3 py-2">Kunde / Lieferant</th>
                <th className="border border-line px-3 py-2">Leistung</th>
                <th className="border border-line px-3 py-2 text-right">Menge</th>
                <th className="border border-line px-3 py-2 text-right">Einzelpreis</th>
                <th className="border border-line px-3 py-2 text-right">Netto gesamt</th>
                <th className="border border-line px-3 py-2 text-right">MwSt</th>
                <th className="border border-line px-3 py-2 text-right">Brutto gesamt</th>
                <th className="border border-line px-3 py-2">Kategorie</th>
                {hatAktionen && <th className="border border-line px-3 py-2 text-center">Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((b) => {
                const gesperrt = gesperrteMonate.includes(getMonatJahr(b))
                return (
                  <tr key={b.id} className={`hover:bg-surface-2 ${gesperrt ? "opacity-70" : ""}`}>
                    <td className="border border-line px-3 py-2 whitespace-nowrap">
                      {b.datum}
                      {gesperrt && <span className="ml-1 text-xs text-faint">🔒</span>}
                    </td>
                    <td className="border border-line px-3 py-2">{b.belegnummer ?? "—"}</td>
                    <td className="border border-line px-3 py-2">{b.kunde_lieferant ?? "—"}</td>
                    <td className="border border-line px-3 py-2">{b.leistungsbeschreibung}</td>
                    <td className="border border-line px-3 py-2 text-right">{b.menge}</td>
                    <td className="border border-line px-3 py-2 text-right">{formatEuro(b.einzelpreis)}</td>
                    <td className="border border-line px-3 py-2 text-right font-medium">{formatEuro(b.nettobetrag)}</td>
                    <td className="border border-line px-3 py-2 text-right">{b.mwst_satz} %</td>
                    <td className="border border-line px-3 py-2 text-right font-medium text-brand-ink tnum">
                      {formatEuro(b.bruttobetrag ?? b.nettobetrag * (1 + b.mwst_satz / 100))}
                    </td>
                    <td className="border border-line px-3 py-2 text-muted">{b.kategorie ?? "—"}</td>
                    {hatAktionen && (
                      <td className="border border-line px-3 py-2">
                        <div className="flex gap-2 justify-center">
                          {onVorlage && (
                            <button
                              onClick={() => onVorlage(b)}
                              className="text-xs text-muted hover:text-ink border border-line rounded px-2 py-0.5"
                              title="Als Vorlage speichern"
                            >
                              ⭐
                            </button>
                          )}
                          {!gesperrt && onBearbeiten && (
                            <button
                              onClick={() => onBearbeiten(b)}
                              className="text-xs text-brand hover:text-brand-deep border border-line rounded px-2 py-0.5"
                            >
                              Bearb.
                            </button>
                          )}
                          {!gesperrt && onLoeschen && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Eintrag "${b.leistungsbeschreibung}" wirklich löschen?`))
                                  onLoeschen(b.id)
                              }}
                              className="text-xs text-neg hover:opacity-80 border border-line rounded px-2 py-0.5"
                            >
                              Lösch.
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
