"use client"

import { useState, useEffect } from "react"
import { ladeFunktionen, speichereFunktionen } from "@/lib/storage"
import {
  Funktionen, FUNKTION_DEFAULT, FUNKTIONEN_META, FunktionsKey,
  istFunktionAktiv, ONBOARDING_EVENT,
} from "@/lib/einstellungen"
import Toast from "@/components/Toast"

function Schalter({ an, disabled, onToggle }: { an: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={an}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed bg-surface-2" : an ? "bg-brand" : "bg-line"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
          an ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export default function EinstellungenPage() {
  const [funktionen, setFunktionen] = useState<Funktionen>(FUNKTION_DEFAULT)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { setFunktionen(ladeFunktionen()) }, [])

  function toggle(key: FunktionsKey) {
    const next = { ...funktionen, [key]: !funktionen[key] }
    setFunktionen(next)
    speichereFunktionen(next)
  }

  function setzeAlle(wert: boolean) {
    const next = Object.fromEntries(FUNKTIONEN_META.map((m) => [m.key, wert])) as Funktionen
    setFunktionen(next)
    speichereFunktionen(next)
    setToast(wert ? "Alle Module aktiviert" : "Auf Kernfunktionen reduziert")
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold">Einstellungen</h1>
        <p className="text-sm text-muted mt-0.5">
          Schalte nur die Module ein, die du brauchst — der Rest bleibt aus dem Weg. Ausschalten
          <strong className="text-ink-soft"> blendet nur aus</strong>; deine Daten bleiben erhalten.
        </p>
      </div>

      <section className="bg-surface border rounded-xl shadow-sm divide-y divide-line">
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-faint uppercase tracking-wide">Funktionen</span>
          <div className="flex gap-2">
            <button onClick={() => setzeAlle(true)} className="text-xs text-brand hover:underline">Alle an</button>
            <span className="text-faint text-xs">·</span>
            <button onClick={() => setzeAlle(false)} className="text-xs text-muted hover:underline">Nur Kern</button>
          </div>
        </div>

        {FUNKTIONEN_META.map((m) => {
          const elternAus = !!m.haengtAb && !funktionen[m.haengtAb]
          const wirksam = istFunktionAktiv(funktionen, m.key)
          return (
            <div
              key={m.key}
              className={`px-5 py-4 flex items-start justify-between gap-4 ${m.haengtAb ? "pl-9" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {m.haengtAb && <span className="text-faint text-xs">↳</span>}
                  <span className={`font-medium text-sm ${wirksam ? "text-ink" : "text-muted"}`}>{m.label}</span>
                </div>
                <p className="text-xs text-muted mt-0.5">{m.beschreibung}</p>
                {elternAus && (
                  <p className="text-xs text-faint mt-1 italic">
                    Benötigt „{FUNKTIONEN_META.find((x) => x.key === m.haengtAb)?.label}“.
                  </p>
                )}
              </div>
              <Schalter an={wirksam} disabled={elternAus} onToggle={() => toggle(m.key)} />
            </div>
          )
        })}
      </section>

      {/* Kernfunktionen-Hinweis */}
      <p className="text-xs text-faint">
        Immer verfügbar (nicht abschaltbar): Einnahmen, Ausgaben, Jahresübersicht, Unternehmensprofile und Backup.
      </p>

      {/* Einrichtungs-Assistent */}
      <section className="bg-surface border rounded-xl p-5 shadow-sm flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Einrichtungs-Assistent</h2>
          <p className="text-xs text-muted mt-0.5">Die geführte Auswahl der Module erneut durchlaufen.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event(ONBOARDING_EVENT))}
          className="bg-surface-2 text-ink-soft px-4 py-2 rounded-lg hover:bg-line text-sm font-medium shrink-0"
        >
          Assistent starten
        </button>
      </section>
    </div>
  )
}
