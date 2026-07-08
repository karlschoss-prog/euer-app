"use client"

import { useState, useEffect } from "react"
import {
  ladeFunktionen, speichereFunktionen, hatFunktionenGesetzt,
  ladeProfile, ladeBelege, ladeRechnungen,
} from "@/lib/storage"
import {
  Funktionen, FUNKTION_DEFAULT, FUNKTIONEN_META, FunktionsKey,
  istFunktionAktiv, ONBOARDING_EVENT,
} from "@/lib/einstellungen"

// Frische Installation: noch keine Profile, Belege oder Rechnungen angelegt.
function istFrisch(): boolean {
  return ladeProfile().length === 0 && ladeBelege().length === 0 && ladeRechnungen().length === 0
}

export default function OnboardingWizard() {
  const [offen, setOffen] = useState(false)
  const [auswahl, setAuswahl] = useState<Funktionen>(FUNKTION_DEFAULT)

  useEffect(() => {
    // Beim Erststart (noch nie konfiguriert + frische Installation) automatisch zeigen
    if (!hatFunktionenGesetzt() && istFrisch()) {
      setAuswahl(FUNKTION_DEFAULT)
      setOffen(true)
    }
    // Aus den Einstellungen erneut aufrufbar
    const oeffne = () => { setAuswahl(ladeFunktionen()); setOffen(true) }
    window.addEventListener(ONBOARDING_EVENT, oeffne)
    return () => window.removeEventListener(ONBOARDING_EVENT, oeffne)
  }, [])

  if (!offen) return null

  function toggle(key: FunktionsKey) {
    setAuswahl((a) => ({ ...a, [key]: !a[key] }))
  }

  function fertig() {
    speichereFunktionen(auswahl)
    setOffen(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-line rounded-2xl shadow-card-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-1 border-b border-line">
          <h2 className="text-xl font-bold">Willkommen 👋</h2>
          <p className="text-sm text-muted">
            Wähle die Module, die zu deinem Betrieb passen. Du kannst alles jederzeit in den
            Einstellungen ändern — Ausschalten blendet nur aus, es löscht nichts.
          </p>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs font-semibold text-faint uppercase tracking-wide">Immer dabei</p>
          <p className="text-xs text-muted -mt-1">
            Einnahmen, Ausgaben, Jahresübersicht (EÜR), Unternehmensprofile und Backup.
          </p>

          <p className="text-xs font-semibold text-faint uppercase tracking-wide pt-2">Optionale Module</p>
          <div className="space-y-2">
            {FUNKTIONEN_META.map((m) => {
              const elternAus = !!m.haengtAb && !auswahl[m.haengtAb]
              const an = istFunktionAktiv(auswahl, m.key)
              return (
                <label
                  key={m.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    m.haengtAb ? "ml-6" : ""
                  } ${elternAus ? "opacity-40 cursor-not-allowed" : an ? "border-brand bg-brand-tint" : "border-line hover:bg-surface-2"}`}
                >
                  <input
                    type="checkbox"
                    checked={an}
                    disabled={elternAus}
                    onChange={() => toggle(m.key)}
                    className="mt-0.5 accent-[var(--brand)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-muted mt-0.5">{m.beschreibung}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="p-6 border-t border-line flex items-center justify-between gap-3">
          <button
            onClick={() => setAuswahl(FUNKTION_DEFAULT)}
            className="text-xs text-muted hover:underline"
          >
            Alle aktivieren
          </button>
          <button
            onClick={fertig}
            className="bg-brand text-white px-6 py-2.5 rounded-lg hover:bg-brand-deep text-sm font-semibold shadow-card"
          >
            Los geht’s
          </button>
        </div>
      </div>
    </div>
  )
}
