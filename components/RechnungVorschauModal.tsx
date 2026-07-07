"use client"

import { useState, useEffect } from "react"
import { Rechnung } from "@/types/beleg"
import { erzeugeRechnungVorschauUrl, erzeugeRechnungPdf } from "@/components/RechnungPdf"

interface Props {
  rechnung: Rechnung
  onClose: () => void
}

export default function RechnungVorschauModal({ rechnung, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    let aktiv = true
    let erzeugteUrl: string | null = null
    erzeugeRechnungVorschauUrl(rechnung)
      .then((u) => {
        if (aktiv) { erzeugteUrl = u; setUrl(u) }
        else URL.revokeObjectURL(u)
      })
      .catch(() => aktiv && setFehler(true))
    return () => {
      aktiv = false
      if (erzeugteUrl) URL.revokeObjectURL(erzeugteUrl)
    }
  }, [rechnung])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-line rounded-2xl shadow-card-lg w-full max-w-3xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
          <h2 className="font-semibold text-sm text-ink">Vorschau — Rechnung {rechnung.rechnungsnummer}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => erzeugeRechnungPdf(rechnung)}
              className="bg-brand text-white px-4 py-1.5 rounded-lg hover:bg-brand-deep text-xs font-semibold"
            >
              PDF herunterladen
            </button>
            <button onClick={onClose} className="text-faint hover:text-ink text-xl leading-none">×</button>
          </div>
        </div>
        <div className="flex-1 bg-surface-2">
          {fehler ? (
            <div className="h-full flex items-center justify-center text-sm text-neg">
              Vorschau konnte nicht erstellt werden.
            </div>
          ) : url ? (
            <iframe src={url} title="Rechnungsvorschau" className="w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-faint">
              Vorschau wird erstellt…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
