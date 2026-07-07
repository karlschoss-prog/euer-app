"use client"

import { useState, useEffect } from "react"
import { Unternehmensprofil, RechnungDesign } from "@/types/beleg"
import { ladeProfile, speichereProfil, loescheProfil } from "@/lib/storage"
import Toast from "@/components/Toast"
import { v4 as uuidv4 } from "uuid"

const DESIGNS: { id: RechnungDesign; label: string; beschreibung: string; standardfarbe: string }[] = [
  { id: "klassisch", label: "Klassisch", beschreibung: "Seriös & aufgeräumt — ideal für professionelle Leistungen.", standardfarbe: "#2563eb" },
  { id: "kreativ", label: "Kreativ", beschreibung: "Farbband, große Typo, Dank-Note — fällt auf (UGC).", standardfarbe: "#ec4899" },
  { id: "elegant", label: "Elegant", beschreibung: "Viel Weißraum, Serifenschrift, minimal — hochwertig.", standardfarbe: "#262626" },
  { id: "ks-rec", label: "KS · REC (UGC)", beschreibung: "Kamera-Sucher-Look, roter Akzent — für Kleinunternehmer (§19).", standardfarbe: "#D23A2F" },
]

function leeresProfil(): Unternehmensprofil {
  return {
    id: uuidv4(),
    name: "",
    firmenname: "",
    kleinunternehmer: false,
    design: "klassisch",
    akzentfarbe: "#2563eb",
    zahlungszielTage: 14,
    rechnungsnummerPrefix: `${new Date().getFullYear()}-`,
    rechnungsnummerStellen: 3,
    naechsteRechnungsnummer: 1,
    erstellt_am: new Date().toISOString(),
  }
}

function Feld({
  label, value, onChange, placeholder, type = "text", breit = false,
}: {
  label: string; value: string | number; onChange: (v: string) => void
  placeholder?: string; type?: string; breit?: boolean
}) {
  return (
    <div className={breit ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  )
}

export default function UnternehmenPage() {
  const [profile, setProfile] = useState<Unternehmensprofil[]>([])
  const [entwurf, setEntwurf] = useState<Unternehmensprofil | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function laden() { setProfile(ladeProfile()) }
  useEffect(() => { laden() }, [])

  function set<K extends keyof Unternehmensprofil>(key: K, wert: Unternehmensprofil[K]) {
    setEntwurf((p) => (p ? { ...p, [key]: wert } : p))
  }

  function speichern() {
    if (!entwurf) return
    if (!entwurf.name.trim() || !entwurf.firmenname.trim()) {
      setToast("Bitte Bezeichnung und Firmenname angeben")
      return
    }
    speichereProfil(entwurf)
    setEntwurf(null)
    laden()
    setToast("Profil gespeichert")
  }

  function loeschen(p: Unternehmensprofil) {
    if (!window.confirm(`Profil "${p.name}" wirklich löschen?`)) return
    loescheProfil(p.id)
    laden()
    setToast("Profil gelöscht")
  }

  async function logoWaehlen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set("logo", reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unternehmen</h1>
          <p className="text-sm text-muted mt-1">Absenderprofile für deine Rechnungen.</p>
        </div>
        {!entwurf && (
          <button
            onClick={() => setEntwurf(leeresProfil())}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium"
          >
            + Neues Profil
          </button>
        )}
      </div>

      {/* Formular */}
      {entwurf && (
        <section className="bg-surface border rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold">
            {profile.some((p) => p.id === entwurf.id) ? "Profil bearbeiten" : "Neues Profil"}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Feld label="Interne Bezeichnung *" value={entwurf.name} onChange={(v) => set("name", v)} placeholder="z. B. Coaching" />
            <Feld label="Firmenname *" value={entwurf.firmenname} onChange={(v) => set("firmenname", v)} placeholder="Mustermann Coaching" />
            <Feld label="Inhaber" value={entwurf.inhaber ?? ""} onChange={(v) => set("inhaber", v)} />
            <Feld label="Straße & Nr." value={entwurf.strasse ?? ""} onChange={(v) => set("strasse", v)} />
            <Feld label="PLZ" value={entwurf.plz ?? ""} onChange={(v) => set("plz", v)} />
            <Feld label="Ort" value={entwurf.ort ?? ""} onChange={(v) => set("ort", v)} />
            <Feld label="E-Mail" value={entwurf.email ?? ""} onChange={(v) => set("email", v)} />
            <Feld label="Telefon" value={entwurf.telefon ?? ""} onChange={(v) => set("telefon", v)} />
            <Feld label="Website" value={entwurf.website ?? ""} onChange={(v) => set("website", v)} />
          </div>

          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <Feld label="Steuernummer" value={entwurf.steuernummer ?? ""} onChange={(v) => set("steuernummer", v)} placeholder="12/345/67890" />
            <Feld label="USt-IdNr." value={entwurf.ustIdNr ?? ""} onChange={(v) => set("ustIdNr", v)} placeholder="DE123456789" />
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={entwurf.kleinunternehmer}
                onChange={(e) => set("kleinunternehmer", e.target.checked)}
                className="w-4 h-4"
              />
              Kleinunternehmer nach § 19 UStG (keine MwSt auf Rechnungen)
            </label>
          </div>

          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <Feld label="Kontoinhaber" value={entwurf.kontoinhaber ?? ""} onChange={(v) => set("kontoinhaber", v)} />
            <Feld label="Bank" value={entwurf.bank ?? ""} onChange={(v) => set("bank", v)} />
            <Feld label="IBAN" value={entwurf.iban ?? ""} onChange={(v) => set("iban", v)} />
            <Feld label="BIC" value={entwurf.bic ?? ""} onChange={(v) => set("bic", v)} />
          </div>

          <div className="border-t pt-4 grid grid-cols-3 gap-4">
            <Feld label="Rechnungsnr. Präfix" value={entwurf.rechnungsnummerPrefix} onChange={(v) => set("rechnungsnummerPrefix", v)} placeholder="2026-" />
            <Feld label="Nullstellen" type="number" value={entwurf.rechnungsnummerStellen} onChange={(v) => set("rechnungsnummerStellen", parseInt(v) || 1)} />
            <Feld label="Nächste Nummer" type="number" value={entwurf.naechsteRechnungsnummer} onChange={(v) => set("naechsteRechnungsnummer", parseInt(v) || 1)} />
            <Feld label="Zahlungsziel (Tage)" type="number" value={entwurf.zahlungszielTage} onChange={(v) => set("zahlungszielTage", parseInt(v) || 0)} />
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Rechnungsdesign</p>
            <div className="grid grid-cols-2 gap-3">
              {DESIGNS.map((d) => {
                const aktiv = (entwurf.design ?? "klassisch") === d.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { set("design", d.id); set("akzentfarbe", d.standardfarbe) }}
                    className={`text-left border rounded-lg p-3 transition-colors ${
                      aktiv ? "border-brand ring-2 ring-brand-tint bg-brand-tint" : "border-line hover:border-line"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.standardfarbe }} />
                      <span className="text-sm font-semibold">{d.label}</span>
                    </div>
                    <span className="text-xs text-muted leading-tight block">{d.beschreibung}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-muted">Akzentfarbe</label>
              <input
                type="color"
                value={entwurf.akzentfarbe ?? "#2563eb"}
                onChange={(e) => set("akzentfarbe", e.target.value)}
                className="h-8 w-12 border rounded cursor-pointer"
              />
              <span className="text-xs text-faint">{entwurf.akzentfarbe}</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Einleitungstext (optional)</label>
              <textarea
                value={entwurf.einleitungstext ?? ""}
                onChange={(e) => set("einleitungstext", e.target.value)}
                placeholder="Vielen Dank für Ihren Auftrag. Hiermit stelle ich Ihnen folgende Leistungen in Rechnung:"
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Fußtext (optional)</label>
              <textarea
                value={entwurf.fusstext ?? ""}
                onChange={(e) => set("fusstext", e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Logo (optional)</label>
              <div className="flex items-center gap-3">
                {entwurf.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entwurf.logo} alt="Logo" className="h-12 border rounded bg-surface object-contain px-2" />
                )}
                <input type="file" accept="image/png,image/jpeg" onChange={logoWaehlen} className="text-sm" />
                {entwurf.logo && (
                  <button onClick={() => set("logo", undefined)} className="text-xs text-neg hover:text-neg">
                    entfernen
                  </button>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!entwurf.istStandard}
                onChange={(e) => set("istStandard", e.target.checked)}
                className="w-4 h-4"
              />
              Als Standardprofil verwenden
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={speichern} className="bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium">
              Speichern
            </button>
            <button onClick={() => setEntwurf(null)} className="bg-surface-2 text-ink-soft px-5 py-2 rounded-lg hover:bg-line text-sm font-medium">
              Abbrechen
            </button>
          </div>
        </section>
      )}

      {/* Liste */}
      {!entwurf && (
        profile.length === 0 ? (
          <div className="bg-surface border-2 border-dashed border-line rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-muted text-sm mb-6">Noch kein Unternehmensprofil. Lege das erste an, um Rechnungen zu erstellen.</p>
            <button onClick={() => setEntwurf(leeresProfil())} className="bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium">
              + Erstes Profil anlegen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.map((p) => (
              <div key={p.id} className="bg-surface border rounded-xl p-5 shadow-sm flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {p.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo} alt="" className="h-10 object-contain" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.istStandard && <span className="text-xs bg-brand-tint text-brand-ink px-2 py-0.5 rounded-full">Standard</span>}
                      {p.kleinunternehmer && <span className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full">§19</span>}
                      <span className="text-xs text-muted flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.akzentfarbe ?? "#2563eb" }} />
                        {DESIGNS.find((d) => d.id === (p.design ?? "klassisch"))?.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted">{p.firmenname}</p>
                    <p className="text-xs text-faint mt-0.5">
                      {[p.strasse, [p.plz, p.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-xs text-faint">
                      Nächste Rechnungs-Nr.: {p.rechnungsnummerPrefix}{String(p.naechsteRechnungsnummer).padStart(p.rechnungsnummerStellen, "0")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm shrink-0">
                  <button onClick={() => setEntwurf(p)} className="text-brand hover:underline">Bearbeiten</button>
                  <button onClick={() => loeschen(p)} className="text-neg hover:underline">Löschen</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
