"use client"

import { useState, useEffect } from "react"
import { Kunde } from "@/types/beleg"
import { ladeKunden, speichereKunde, loescheKunde } from "@/lib/storage"
import Toast from "@/components/Toast"
import { v4 as uuidv4 } from "uuid"

function leererKunde(): Kunde {
  return { id: uuidv4(), name: "", erstellt_am: new Date().toISOString() }
}

function Feld({
  label, value, onChange, placeholder, breit = false,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; breit?: boolean
}) {
  return (
    <div className={breit ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-muted mb-1">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  )
}

export default function KundenPage() {
  const [kunden, setKunden] = useState<Kunde[]>([])
  const [entwurf, setEntwurf] = useState<Kunde | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [suche, setSuche] = useState("")

  function laden() { setKunden(ladeKunden()) }
  useEffect(() => { laden() }, [])

  function set<K extends keyof Kunde>(key: K, wert: Kunde[K]) {
    setEntwurf((k) => (k ? { ...k, [key]: wert } : k))
  }

  function speichern() {
    if (!entwurf) return
    if (!entwurf.name.trim()) { setToast("Bitte einen Namen angeben"); return }
    speichereKunde(entwurf)
    setEntwurf(null)
    laden()
    setToast("Kunde gespeichert")
  }

  function loeschen(k: Kunde) {
    if (!window.confirm(`Kunde "${k.name}" wirklich löschen?`)) return
    loescheKunde(k.id)
    laden()
    setToast("Kunde gelöscht")
  }

  const gefiltert = kunden
    .filter((k) => k.name.toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kunden</h1>
          <p className="text-sm text-muted mt-1">Dein Adressbuch für Rechnungen.</p>
        </div>
        {!entwurf && (
          <button
            onClick={() => setEntwurf(leererKunde())}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium"
          >
            + Neuer Kunde
          </button>
        )}
      </div>

      {entwurf && (
        <section className="bg-surface border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">
            {kunden.some((k) => k.id === entwurf.id) ? "Kunde bearbeiten" : "Neuer Kunde"}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Feld label="Name / Firma *" value={entwurf.name} onChange={(v) => set("name", v)} breit />
            <Feld label="Ansprechpartner" value={entwurf.ansprechpartner ?? ""} onChange={(v) => set("ansprechpartner", v)} />
            <Feld label="E-Mail" value={entwurf.email ?? ""} onChange={(v) => set("email", v)} />
            <Feld label="Straße & Nr." value={entwurf.strasse ?? ""} onChange={(v) => set("strasse", v)} breit />
            <Feld label="PLZ" value={entwurf.plz ?? ""} onChange={(v) => set("plz", v)} />
            <Feld label="Ort" value={entwurf.ort ?? ""} onChange={(v) => set("ort", v)} />
            <Feld label="Land" value={entwurf.land ?? ""} onChange={(v) => set("land", v)} />
            <Feld label="USt-IdNr. (für B2B)" value={entwurf.ustIdNr ?? ""} onChange={(v) => set("ustIdNr", v)} />
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted mb-1">Notiz</label>
              <textarea
                value={entwurf.notiz ?? ""}
                onChange={(e) => set("notiz", e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={speichern} className="bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium">Speichern</button>
            <button onClick={() => setEntwurf(null)} className="bg-surface-2 text-ink-soft px-5 py-2 rounded-lg hover:bg-line text-sm font-medium">Abbrechen</button>
          </div>
        </section>
      )}

      {!entwurf && (
        kunden.length === 0 ? (
          <div className="bg-surface border-2 border-dashed border-line rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-muted text-sm mb-6">Noch keine Kunden gespeichert.</p>
            <button onClick={() => setEntwurf(leererKunde())} className="bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium">
              + Ersten Kunden anlegen
            </button>
          </div>
        ) : (
          <>
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Kunde suchen…"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="space-y-2">
              {gefiltert.map((k) => (
                <div key={k.id} className="bg-surface border rounded-xl p-4 shadow-sm flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{k.name}</h3>
                    <p className="text-xs text-muted">
                      {[k.ansprechpartner, k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                    </p>
                    {k.email && <p className="text-xs text-faint">{k.email}</p>}
                  </div>
                  <div className="flex gap-3 text-sm shrink-0">
                    <button onClick={() => setEntwurf(k)} className="text-brand hover:underline">Bearbeiten</button>
                    <button onClick={() => loeschen(k)} className="text-neg hover:underline">Löschen</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}
    </div>
  )
}
