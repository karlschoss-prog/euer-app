"use client"

import { useState, useEffect } from "react"
import { Mahnung, Rechnung } from "@/types/beleg"
import { erzeugeMahnungVorschauUrl, erzeugeMahnungPdf } from "@/components/MahnungPdf"
import { mahnStufeConfig } from "@/lib/mahnung"

interface Props {
  mahnung: Mahnung
  rechnung: Rechnung
  onClose: () => void
}

export default function MahnungVorschauModal({ mahnung, rechnung, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    let aktiv = true
    let erzeugteUrl: string | null = null
    erzeugeMahnungVorschauUrl(mahnung, rechnung)
      .then((u) => {
        if (aktiv) { erzeugteUrl = u; setUrl(u) }
        else URL.revokeObjectURL(u)
      })
      .catch(() => aktiv && setFehler(true))
    return () => {
      aktiv = false
      if (erzeugteUrl) URL.revokeObjectURL(erzeugteUrl)
    }
  }, [mahnung, rechnung])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h2 className="font-semibold text-sm">
            Vorschau — {mahnStufeConfig(mahnung.stufe).label} zu Rechnung {rechnung.rechnungsnummer}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => erzeugeMahnungPdf(mahnung, rechnung)}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-xs font-semibold"
            >
              PDF herunterladen
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100">
          {fehler ? (
            <div className="h-full flex items-center justify-center text-sm text-red-600">
              Vorschau konnte nicht erstellt werden.
            </div>
          ) : url ? (
            <iframe src={url} title="Mahnungsvorschau" className="w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Vorschau wird erstellt…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
