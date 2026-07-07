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

const IconIn = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" /></svg>
)
const IconOut = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v5.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V5z" clipRule="evenodd" /></svg>
)
const IconChart = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
)

type KpiVariant = "pos" | "neg" | "brand" | "neutral"

function KpiTile({ label, value, variant, icon }: { label: string; value: number; variant: KpiVariant; icon: React.ReactNode }) {
  const s = {
    pos: { ic: "bg-pos-tint text-pos", val: "text-pos" },
    neg: { ic: "bg-neg-tint text-neg", val: "text-neg" },
    brand: { ic: "bg-brand-tint text-brand", val: "text-brand-ink" },
    neutral: { ic: "bg-surface-2 text-muted", val: "text-ink" },
  }[variant]
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-card flex flex-col gap-3">
      <span className={`grid place-items-center w-8 h-8 rounded-lg ${s.ic}`}>{icon}</span>
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-faint">{label}</p>
        <p className={`text-[1.65rem] font-bold mt-0.5 tnum ${s.val}`}>{formatEuro(value)}</p>
      </div>
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
        <h1 className="text-3xl font-bold tracking-tight mb-8 text-ink">Dashboard {jahr}</h1>
        <div className="bg-surface border-2 border-dashed border-line rounded-3xl p-14 text-center shadow-card">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-ink mb-2">Willkommen bei EÜR-App</h2>
          <p className="text-muted mb-8 max-w-sm mx-auto text-sm">
            Erfasse deine erste Einnahme oder importiere ein bestehendes Backup, um loszulegen.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/einnahmen"
              className="bg-brand text-white px-6 py-3 rounded-xl hover:bg-brand-deep font-semibold text-sm shadow-card"
            >
              + Erste Einnahme erfassen
            </Link>
            <Link
              href="/daten"
              className="bg-surface-2 text-ink-soft px-6 py-3 rounded-xl hover:bg-line font-medium text-sm border border-line"
            >
              Backup importieren
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-7">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {editBeleg && (
        <BelegEditModal
          beleg={editBeleg}
          onSpeichern={handleBearbeiten}
          onAbbrechen={() => setEditBeleg(null)}
        />
      )}

      {/* Kopf */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-faint">Übersicht</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard {jahr}</h1>
        </div>
        <Link
          href="/einnahmen"
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl hover:bg-brand-deep text-sm font-semibold shadow-card"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>
          Buchung erfassen
        </Link>
      </div>

      <KleinunternehmerWarnung jahresEinnahmen={jahresSumme.einnahmen} jahr={jahr} />

      {/* Aktueller Monat */}
      <div className="space-y-3">
        <p className="text-[0.68rem] font-bold text-faint uppercase tracking-[0.14em]">
          {MONATE[monat - 1]} {jahr}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <KpiTile label="Einnahmen" value={monatsEuer.einnahmen} variant="pos" icon={IconIn} />
          <KpiTile label="Ausgaben" value={monatsEuer.ausgaben} variant="neg" icon={IconOut} />
          <KpiTile label="Überschuss" value={monatsEuer.ueberschuss} variant={monatsEuer.ueberschuss >= 0 ? "brand" : "neg"} icon={IconChart} />
        </div>
      </div>

      {/* Gesamtjahr */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[0.68rem] font-bold text-faint uppercase tracking-[0.14em]">Gesamt {jahr}</p>
          <Link href="/jahresuebersicht" className="text-xs font-medium text-brand hover:text-brand-deep">
            Vollständige Jahresübersicht →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <KpiTile label="Einnahmen" value={jahresSumme.einnahmen} variant="neutral" icon={IconIn} />
          <KpiTile label="Ausgaben" value={jahresSumme.ausgaben} variant="neutral" icon={IconOut} />
          <KpiTile label="Überschuss" value={jahresSumme.ueberschuss} variant="neutral" icon={IconChart} />
        </div>
      </div>

      {/* Kontostand — Hero */}
      <section
        className="rounded-2xl p-6 text-white shadow-card-lg relative overflow-hidden flex items-end justify-between gap-4 flex-wrap"
        style={{ backgroundImage: "linear-gradient(135deg, var(--brand), var(--brand-deep))" }}
      >
        <div className="relative z-10">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] opacity-85">Kontostand</p>
          <p className="text-4xl font-extrabold mt-1.5 tnum">{formatEuro(kontostand)}</p>
          <p className="text-xs opacity-80 mt-1.5">
            Anfangsbestand 01.01.{jahr}: {formatEuro(anfangsbestand)} &nbsp;·&nbsp; + Einnahmen − Ausgaben {jahr}
          </p>
        </div>
        {!anfangBearbeiten && (
          <button
            onClick={() => { setAnfangText(anfangsbestand ? anfangsbestand.toFixed(2).replace(".", ",") : ""); setAnfangBearbeiten(true) }}
            className="relative z-10 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0"
          >
            Anfangsbestand bearbeiten
          </button>
        )}
        <span className="pointer-events-none absolute -right-10 -top-16 w-56 h-56 rounded-full bg-white/10" />
      </section>

      {anfangBearbeiten && (
        <div className="bg-surface border border-line rounded-2xl shadow-card p-4 flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Kontostand am 01.01.{jahr} (€)</label>
            <input
              value={anfangText}
              onChange={(e) => setAnfangText(e.target.value)}
              placeholder="0,00"
              className="bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm w-40 placeholder:text-faint"
            />
          </div>
          <button onClick={speichereAnfang} className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-deep text-sm font-semibold">Speichern</button>
          <button onClick={() => setAnfangBearbeiten(false)} className="bg-surface-2 border border-line text-ink-soft px-4 py-2 rounded-lg hover:bg-line text-sm font-medium">Abbrechen</button>
        </div>
      )}

      {/* Letzte Buchungen */}
      {letzteBuchungen.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-ink">Letzte Buchungen</span>
            <div className="flex items-center gap-1">
              {(["alle", "einnahme", "ausgabe"] as const).map((f) => {
                const label = f === "alle" ? "Alle" : f === "einnahme" ? "Einnahmen" : "Ausgaben"
                const active = buchungenFilter === f
                return (
                  <button
                    key={f}
                    onClick={() => setBuchungenFilter(f)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                      active ? "bg-brand-tint text-brand-ink" : "text-muted hover:bg-surface-2"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <ul>
            {letzteBuchungen.map((b) => (
              <li
                key={b.id}
                onClick={() => setEditBeleg(b)}
                className="flex items-center px-5 py-3 gap-4 border-t border-line first:border-t-0 hover:bg-surface-2 transition-colors cursor-pointer group"
              >
                <span className={`grid place-items-center w-7 h-7 text-xs font-bold rounded-lg shrink-0 ${
                  b.typ === "einnahme" ? "bg-pos-tint text-pos" : "bg-neg-tint text-neg"
                }`}>
                  {b.typ === "einnahme" ? "E" : "A"}
                </span>
                <span className="text-xs text-faint shrink-0 w-20 tnum">{b.datum}</span>
                <span className="text-sm text-ink-soft flex-1 truncate">{b.leistungsbeschreibung}</span>
                {b.kunde_lieferant && (
                  <span className="text-xs text-faint truncate max-w-28 hidden sm:block">{b.kunde_lieferant}</span>
                )}
                <span className={`text-sm font-bold shrink-0 tnum ${b.typ === "einnahme" ? "text-pos" : "text-neg"}`}>
                  {b.typ === "einnahme" ? "+" : "−"}{formatEuro(b.nettobetrag)}
                </span>
                <span className="text-faint text-sm group-hover:text-muted shrink-0">›</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nur für mich — freies Kapital */}
      <div className="bg-surface border border-line rounded-2xl shadow-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] font-bold text-faint uppercase tracking-[0.14em]">Nur für mich</span>
          <span className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full border border-line">privat</span>
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
