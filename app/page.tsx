"use client"

import { useState, useEffect } from "react"
import KleinunternehmerWarnung from "@/components/KleinunternehmerWarnung"
import BelegEditModal from "@/components/BelegEditModal"
import Toast from "@/components/Toast"
import { ladeBelege, aktualisiereBeleg, ladeAnfangsbestand, setzeAnfangsbestand } from "@/lib/storage"
import { berechneMonatsEuer, berechneJahresEuer, berechneFreiesKapital } from "@/lib/berechnung"
import { formatEuro } from "@/lib/formatierung"
import { Beleg } from "@/types/beleg"
import { BelegFormData } from "@/components/BelegForm"
import FreiesKapitalChart from "@/components/FreiesKapitalChart"
import Link from "next/link"

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

function KpiKarte({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className={`border rounded-xl px-5 py-4 shadow-sm ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-2xl font-bold mt-1">{formatEuro(value)}</p>
    </div>
  )
}

export default function DashboardPage() {
  const heute = new Date()
  const monat = heute.getMonth() + 1
  const jahr = heute.getFullYear()
  const [belege, setBelege] = useState<Beleg[]>([])
  const [editBeleg, setEditBeleg] = useState<Beleg | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [anfangsbestand, setAnfangsbestand] = useState(0)
  const [anfangBearbeiten, setAnfangBearbeiten] = useState(false)
  const [anfangText, setAnfangText] = useState("")

  function laden() {
    setBelege(ladeBelege())
    setAnfangsbestand(ladeAnfangsbestand(jahr))
  }
  useEffect(() => { laden() }, [])

  function speichereAnfang() {
    const betrag = parseFloat(anfangText.replace(/\./g, "").replace(",", ".")) || 0
    setzeAnfangsbestand(jahr, betrag)
    setAnfangsbestand(betrag)
    setAnfangBearbeiten(false)
    setToast("Anfangskontostand gespeichert")
  }

  const monatsEuer = berechneMonatsEuer(belege, monat, jahr)
  const jahresSumme = berechneJahresEuer(belege, jahr).reduce(
    (acc, m) => ({
      einnahmen: acc.einnahmen + m.einnahmen,
      ausgaben: acc.ausgaben + m.ausgaben,
      ueberschuss: acc.ueberschuss + m.ueberschuss,
    }),
    { einnahmen: 0, ausgaben: 0, ueberschuss: 0 }
  )

  const kontostand = anfangsbestand + jahresSumme.einnahmen - jahresSumme.ausgaben
  const freiesKapital = berechneFreiesKapital(jahresSumme.einnahmen, jahresSumme.ausgaben)

  const [buchungenFilter, setBuchungenFilter] = useState<"alle" | "einnahme" | "ausgabe">("alle")

  const letzteBuchungen = [...belege]
    .filter((b) => buchungenFilter === "alle" || b.typ === buchungenFilter)
    .sort((a, b) => new Date(b.erstellt_am).getTime() - new Date(a.erstellt_am).getTime())
    .slice(0, buchungenFilter === "alle" ? 5 : 10)

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

  // Empty State
  if (belege.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-8">Dashboard {jahr}</h1>
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-14 text-center shadow-sm">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Willkommen bei EÜR-App</h2>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto text-sm">
            Erfasse deine erste Einnahme oder importiere ein bestehendes Backup, um loszulegen.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/einnahmen"
              className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-medium text-sm"
            >
              + Erste Einnahme erfassen
            </Link>
            <Link
              href="/daten"
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-medium text-sm"
            >
              Backup importieren
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {editBeleg && (
        <BelegEditModal
          beleg={editBeleg}
          onSpeichern={handleBearbeiten}
          onAbbrechen={() => setEditBeleg(null)}
        />
      )}

      <h1 className="text-2xl font-bold">Dashboard {jahr}</h1>

      <KleinunternehmerWarnung jahresEinnahmen={jahresSumme.einnahmen} jahr={jahr} />

      {/* Aktueller Monat */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {MONATE[monat - 1]} {jahr}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <KpiKarte label="Einnahmen" value={monatsEuer.einnahmen} colorClass="bg-green-50 border-green-200 text-green-800" />
          <KpiKarte label="Ausgaben" value={monatsEuer.ausgaben} colorClass="bg-red-50 border-red-200 text-red-800" />
          <KpiKarte
            label="Überschuss"
            value={monatsEuer.ueberschuss}
            colorClass={monatsEuer.ueberschuss >= 0 ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-orange-50 border-orange-200 text-orange-800"}
          />
        </div>
      </div>

      {/* Trennlinie */}
      <div className="border-t border-dashed border-gray-200" />

      {/* Gesamtjahr */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Gesamt {jahr}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <KpiKarte label="Einnahmen" value={jahresSumme.einnahmen} colorClass="bg-white border-gray-200 text-gray-800" />
          <KpiKarte label="Ausgaben" value={jahresSumme.ausgaben} colorClass="bg-white border-gray-200 text-gray-800" />
          <KpiKarte
            label="Überschuss"
            value={jahresSumme.ueberschuss}
            colorClass="bg-white border-gray-200 text-gray-800"
          />
        </div>
        <p className="text-right">
          <Link href="/jahresuebersicht" className="text-xs text-blue-600 hover:underline">
            Vollständige Jahresübersicht →
          </Link>
        </p>
      </div>

      {/* Kontostand */}
      <div className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Kontostand</p>
            <p className={`text-2xl font-bold mt-1 ${kontostand >= 0 ? "text-gray-800" : "text-red-700"}`}>
              {formatEuro(kontostand)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Anfangsbestand 01.01.{jahr}: {formatEuro(anfangsbestand)} + Einnahmen − Ausgaben {jahr}
            </p>
          </div>
          {!anfangBearbeiten && (
            <button
              onClick={() => { setAnfangText(anfangsbestand ? anfangsbestand.toFixed(2).replace(".", ",") : ""); setAnfangBearbeiten(true) }}
              className="text-xs text-blue-600 hover:underline shrink-0"
            >
              Anfangsbestand bearbeiten
            </button>
          )}
        </div>
        {anfangBearbeiten && (
          <div className="flex items-end gap-2 mt-4 pt-4 border-t">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kontostand am 01.01.{jahr} (€)</label>
              <input
                value={anfangText}
                onChange={(e) => setAnfangText(e.target.value)}
                placeholder="0,00"
                className="border rounded-lg px-3 py-2 text-sm w-40"
              />
            </div>
            <button onClick={speichereAnfang} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">Speichern</button>
            <button onClick={() => setAnfangBearbeiten(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">Abbrechen</button>
          </div>
        )}
      </div>

      {/* Letzte Buchungen */}
      {letzteBuchungen.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-1">
            {(["alle", "einnahme", "ausgabe"] as const).map((f) => {
              const label = f === "alle" ? "Alle" : f === "einnahme" ? "Einnahmen" : "Ausgaben"
              const active = buchungenFilter === f
              const color = f === "einnahme"
                ? active ? "bg-green-100 text-green-700 border-green-300" : "text-gray-500 border-transparent hover:border-gray-200"
                : f === "ausgabe"
                  ? active ? "bg-red-100 text-red-700 border-red-300" : "text-gray-500 border-transparent hover:border-gray-200"
                  : active ? "bg-gray-100 text-gray-800 border-gray-300" : "text-gray-500 border-transparent hover:border-gray-200"
              return (
                <button
                  key={f}
                  onClick={() => setBuchungenFilter(f)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${color}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <ul className="divide-y divide-gray-50">
            {letzteBuchungen.map((b) => (
              <li
                key={b.id}
                onClick={() => setEditBeleg(b)}
                className="flex items-center px-5 py-3 gap-4 hover:bg-gray-50 transition-colors cursor-pointer group"
              >
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  b.typ === "einnahme" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {b.typ === "einnahme" ? "E" : "A"}
                </span>
                <span className="text-xs text-gray-400 shrink-0 w-20">{b.datum}</span>
                <span className="text-sm text-gray-700 flex-1 truncate">{b.leistungsbeschreibung}</span>
                {b.kunde_lieferant && (
                  <span className="text-xs text-gray-400 truncate max-w-28 hidden sm:block">{b.kunde_lieferant}</span>
                )}
                <span className={`text-sm font-semibold shrink-0 ${b.typ === "einnahme" ? "text-green-700" : "text-red-700"}`}>
                  {b.typ === "einnahme" ? "+" : "−"}{formatEuro(b.nettobetrag)}
                </span>
                <span className="text-gray-300 text-sm group-hover:text-gray-400 shrink-0">›</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nur für mich — freies Kapital */}
      <div className="bg-white border rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Nur für mich</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">privat</span>
        </div>
        <FreiesKapitalChart
          einnahmen={freiesKapital.einnahmen}
          ausgaben={freiesKapital.ausgaben}
          ruecklage={freiesKapital.ruecklage}
          frei={freiesKapital.frei}
        />
      </div>
    </div>
  )
}
