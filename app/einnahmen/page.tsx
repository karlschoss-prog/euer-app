"use client"

import { useState, useEffect } from "react"
import BelegForm, { BelegFormData } from "@/components/BelegForm"
import BelegTabelle from "@/components/BelegTabelle"
import BelegEditModal from "@/components/BelegEditModal"
import KleinunternehmerWarnung from "@/components/KleinunternehmerWarnung"
import Toast from "@/components/Toast"
import { Beleg, Vorlage } from "@/types/beleg"
import {
  ladeBelege, speichereBeleg, loescheBeleg, aktualisiereBeleg,
  ladeVorlagen, speichereVorlage, ladeGesperrteMonate,
} from "@/lib/storage"
import { formatEuro } from "@/lib/formatierung"
import { berechneJahresEinnahmen } from "@/lib/berechnung"
import { v4 as uuidv4 } from "uuid"

export default function EinnahmenPage() {
  const [belege, setBelege] = useState<Beleg[]>([])
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([])
  const [gesperrteMonate, setGesperrteMonate] = useState<string[]>([])
  const [editBeleg, setEditBeleg] = useState<Beleg | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)

  const heute = new Date()
  const monat = heute.getMonth() + 1
  const jahr = heute.getFullYear()
  const [alleAnzeigen, setAlleAnzeigen] = useState(false)

  function laden() {
    setBelege(ladeBelege().filter((b) => b.typ === "einnahme"))
    setVorlagen(ladeVorlagen())
    setGesperrteMonate(ladeGesperrteMonate())
  }

  useEffect(() => { laden() }, [])

  const jahresEinnahmen = berechneJahresEinnahmen(belege, jahr)

  const naechsteBelegnummer = (() => {
    const count = belege.filter((b) => b.datum.endsWith(String(jahr))).length
    return `${jahr}-${String(count + 1).padStart(3, "0")}`
  })()

  function handleSpeichern(data: BelegFormData) {
    const netto = data.menge * data.einzelpreis
    const beleg: Beleg = {
      id: uuidv4(), typ: "einnahme", ...data,
      gesamtpreis: netto, nettobetrag: netto,
      bruttobetrag: netto * (1 + data.mwst_satz / 100),
      erstellt_am: new Date().toISOString(),
    }
    speichereBeleg(beleg)
    laden()
    setFormKey((k) => k + 1)
    setToast("Einnahme gespeichert")
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

  function handleLoeschen(id: string) {
    loescheBeleg(id)
    laden()
    setToast("Eintrag gelöscht")
  }

  function handleVorlage(beleg: Beleg) {
    const vorlage: Vorlage = {
      id: uuidv4(), typ: "einnahme",
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

  const MONATE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]

  const monatsbelege = belege.filter((b) => {
    const [, m, j] = b.datum.split(".")
    return parseInt(m) === monat && parseInt(j) === jahr
  })

  const anzeigebelege = alleAnzeigen ? belege : monatsbelege
  const gesamt = anzeigebelege.reduce((s, b) => s + b.nettobetrag, 0)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {editBeleg && (
        <BelegEditModal
          beleg={editBeleg}
          onSpeichern={handleBearbeiten}
          onAbbrechen={() => setEditBeleg(null)}
        />
      )}

      <h1 className="text-2xl font-bold">Einnahmen erfassen</h1>

      {jahresEinnahmen >= 25000 * 0.7 && (
        <KleinunternehmerWarnung jahresEinnahmen={jahresEinnahmen} jahr={jahr} />
      )}

      <section className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Neue Einnahme</h2>
        <BelegForm
          key={formKey}
          typ="einnahme"
          onSpeichern={handleSpeichern}
          vorlagen={vorlagen}
          naechsteBelegnummer={naechsteBelegnummer}
        />
      </section>

      <section className="bg-white border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              {alleAnzeigen ? "Alle Einnahmen" : `Einnahmen ${MONATE[monat - 1]} ${jahr}`}
            </h2>
            <button
              onClick={() => setAlleAnzeigen((v) => !v)}
              className="text-xs text-blue-600 hover:underline mt-0.5"
            >
              {alleAnzeigen ? "← Nur aktuellen Monat anzeigen" : "Alle Einnahmen anzeigen →"}
            </button>
          </div>
          <span className="text-sm font-medium text-green-700">Gesamt: {formatEuro(gesamt)}</span>
        </div>
        <BelegTabelle
          belege={anzeigebelege}
          onLoeschen={handleLoeschen}
          onBearbeiten={setEditBeleg}
          onVorlage={handleVorlage}
          gesperrteMonate={gesperrteMonate}
        />
      </section>
    </div>
  )
}
