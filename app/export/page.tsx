"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import BelegTabelle from "@/components/BelegTabelle"
import BelegEditModal from "@/components/BelegEditModal"
import PdfExport from "@/components/PdfExport"
import Toast from "@/components/Toast"
import { Beleg, Vorlage } from "@/types/beleg"
import {
  ladeBelege, loescheBeleg, aktualisiereBeleg,
  ladeVorlagen, speichereVorlage, ladeGesperrteMonate,
} from "@/lib/storage"
import { formatEuro } from "@/lib/formatierung"
import { berechneMonatsEuer, berechneJahresEuer } from "@/lib/berechnung"
import { v4 as uuidv4 } from "uuid"
import { BelegFormData } from "@/components/BelegForm"

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

export default function ExportPage() {
  const params = useSearchParams()
  const heute = new Date()

  // monat === 0 means full year
  const [monat, setMonat] = useState(
    params.get("monat") ? parseInt(params.get("monat")!) : heute.getMonth() + 1
  )
  const [jahr, setJahr] = useState(
    params.get("jahr") ? parseInt(params.get("jahr")!) : heute.getFullYear()
  )
  const [alleBelege, setAlleBelege] = useState<Beleg[]>([])
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([])
  const [gesperrteMonate, setGesperrteMonate] = useState<string[]>([])
  const [editBeleg, setEditBeleg] = useState<Beleg | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [einnahmenAufgeklappt, setEinnahmenAufgeklappt] = useState(true)
  const [ausgabenAufgeklappt, setAusgabenAufgeklappt] = useState(true)

  function laden() {
    setAlleBelege(ladeBelege())
    setVorlagen(ladeVorlagen())
    setGesperrteMonate(ladeGesperrteMonate())
  }

  useEffect(() => { laden() }, [])

  const jahresSumme = berechneJahresEuer(alleBelege, jahr).reduce(
    (acc, m) => ({
      einnahmen: acc.einnahmen + m.einnahmen,
      ausgaben: acc.ausgaben + m.ausgaben,
      ueberschuss: acc.ueberschuss + m.ueberschuss,
    }),
    { einnahmen: 0, ausgaben: 0, ueberschuss: 0 }
  )

  const { einnahmen: sumMonatEin, ausgaben: sumMonatAus, ueberschuss: ueberschussMonat } =
    monat > 0 ? berechneMonatsEuer(alleBelege, monat, jahr) : { einnahmen: 0, ausgaben: 0, ueberschuss: 0 }

  const displayEin = monat === 0 ? jahresSumme.einnahmen : sumMonatEin
  const displayAus = monat === 0 ? jahresSumme.ausgaben : sumMonatAus
  const displayUeberschuss = monat === 0 ? jahresSumme.ueberschuss : ueberschussMonat

  const einnahmen = alleBelege.filter((b) => {
    const [, mon, j] = b.datum.split(".")
    if (monat === 0) return b.typ === "einnahme" && parseInt(j) === jahr
    return b.typ === "einnahme" && parseInt(mon) === monat && parseInt(j) === jahr
  })

  const ausgaben = alleBelege.filter((b) => {
    const [, mon, j] = b.datum.split(".")
    if (monat === 0) return b.typ === "ausgabe" && parseInt(j) === jahr
    return b.typ === "ausgabe" && parseInt(mon) === monat && parseInt(j) === jahr
  })

  function handleLoeschen(id: string) {
    loescheBeleg(id)
    laden()
    setToast("Eintrag gelöscht")
  }

  function handleBearbeiten(data: BelegFormData) {
    if (!editBeleg) return
    const netto = data.menge * data.einzelpreis
    aktualisiereBeleg({
      ...editBeleg, ...data,
      gesamtpreis: netto, nettobetrag: netto,
      bruttobetrag: netto * (1 + data.mwst_satz / 100),
    })
    setEditBeleg(null)
    laden()
    setToast("Änderungen gespeichert")
  }

  function handleVorlage(beleg: Beleg) {
    const vorlage: Vorlage = {
      id: uuidv4(), typ: beleg.typ,
      name: beleg.leistungsbeschreibung,
      leistungsbeschreibung: beleg.leistungsbeschreibung,
      kunde_lieferant: beleg.kunde_lieferant,
      menge: beleg.menge, einzelpreis: beleg.einzelpreis,
      mwst_satz: beleg.mwst_satz, kategorie: beleg.kategorie,
    }
    speichereVorlage(vorlage)
    setVorlagen(ladeVorlagen())
    setToast("Vorlage gespeichert")
  }

  const hatDaten = einnahmen.length > 0 || ausgaben.length > 0
  const titelZeitraum = monat === 0 ? `Gesamtes Jahr ${jahr}` : `${MONATE[monat - 1]} ${jahr}`

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {editBeleg && (
        <BelegEditModal
          beleg={editBeleg}
          onSpeichern={handleBearbeiten}
          onAbbrechen={() => setEditBeleg(null)}
        />
      )}

      <h1 className="text-2xl font-bold">PDF-Export</h1>

      {/* Zeitraumauswahl */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Zeitraum</label>
          <select
            value={monat}
            onChange={(e) => setMonat(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value={0}>Gesamtes Jahr {jahr}</option>
            {MONATE.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Jahr</label>
          <input
            type="number"
            value={jahr}
            onChange={(e) => setJahr(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm w-24"
          />
        </div>
      </div>

      {/* Zusammenfassung + PDF-Button */}
      <div className="bg-white border rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">{titelZeitraum}</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-xs text-green-700 font-medium">Einnahmen</p>
            <p className="text-xl font-bold text-green-800">{formatEuro(displayEin)}</p>
            <p className="text-xs text-green-600 mt-0.5">{einnahmen.length} Belege</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-xs text-red-700 font-medium">Ausgaben</p>
            <p className="text-xl font-bold text-red-800">{formatEuro(displayAus)}</p>
            <p className="text-xs text-red-600 mt-0.5">{ausgaben.length} Belege</p>
          </div>
          <div className={`border rounded-lg px-4 py-3 ${displayUeberschuss >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
            <p className={`text-xs font-medium ${displayUeberschuss >= 0 ? "text-blue-700" : "text-orange-700"}`}>Überschuss</p>
            <p className={`text-xl font-bold ${displayUeberschuss >= 0 ? "text-blue-800" : "text-orange-800"}`}>{formatEuro(displayUeberschuss)}</p>
          </div>
        </div>

        {hatDaten ? (
          <PdfExport belege={alleBelege} monat={monat} jahr={jahr} modus={monat === 0 ? "jahr" : "monat"} />
        ) : (
          <p className="text-sm text-gray-400 italic">Keine Belege für diesen Zeitraum vorhanden.</p>
        )}
      </div>

      {/* Belege-Details — kollabierbar */}
      {einnahmen.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setEinnahmenAufgeklappt((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-sm text-green-700">
              Einnahmen — {einnahmen.length} {einnahmen.length === 1 ? "Beleg" : "Belege"}
            </span>
            <span className="text-gray-400 text-sm">{einnahmenAufgeklappt ? "▲" : "▼"}</span>
          </button>
          {einnahmenAufgeklappt && (
            <div className="px-5 pb-5 border-t">
              <div className="mt-4">
                <BelegTabelle
                  belege={einnahmen}
                  onLoeschen={handleLoeschen}
                  onBearbeiten={setEditBeleg}
                  onVorlage={handleVorlage}
                  gesperrteMonate={gesperrteMonate}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {ausgaben.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setAusgabenAufgeklappt((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-sm text-red-700">
              Ausgaben — {ausgaben.length} {ausgaben.length === 1 ? "Beleg" : "Belege"}
            </span>
            <span className="text-gray-400 text-sm">{ausgabenAufgeklappt ? "▲" : "▼"}</span>
          </button>
          {ausgabenAufgeklappt && (
            <div className="px-5 pb-5 border-t">
              <div className="mt-4">
                <BelegTabelle
                  belege={ausgaben}
                  onLoeschen={handleLoeschen}
                  onBearbeiten={setEditBeleg}
                  onVorlage={handleVorlage}
                  gesperrteMonate={gesperrteMonate}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
