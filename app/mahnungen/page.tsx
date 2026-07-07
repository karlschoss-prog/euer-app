"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Rechnung, Mahnung, Unternehmensprofil, MahnStufe } from "@/types/beleg"
import { ladeRechnungen, ladeProfile, ladeMahnungen, speichereMahnung, loescheMahnung } from "@/lib/storage"
import { rechnungSummen } from "@/lib/rechnung"
import { formatEuro } from "@/lib/formatierung"
import { mahnStufeConfig, naechsteFaelligeStufe, tageSeitRechnung, berechneMahnung } from "@/lib/mahnung"
import { erzeugeMahnungPdf } from "@/components/MahnungPdf"
import MahnungVorschauModal from "@/components/MahnungVorschauModal"
import Toast from "@/components/Toast"

function heuteDe(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
}

// Farbgebung der Stufen-Badges (eskalierend).
const STUFE_FARBE: Record<MahnStufe, string> = {
  zahlungserinnerung: "bg-warn-tint text-warn",
  mahnung_1: "bg-warn-tint text-warn",
  mahnung_2: "bg-neg-tint text-neg",
  mahnverfahren: "bg-neg-tint text-neg",
}

interface VorschauState {
  mahnung: Mahnung
  rechnung: Rechnung
}

export default function MahnungenPage() {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([])
  const [profile, setProfile] = useState<Unternehmensprofil[]>([])
  const [mahnungen, setMahnungen] = useState<Mahnung[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [profilFilter, setProfilFilter] = useState("alle")
  const [vorschau, setVorschau] = useState<VorschauState | null>(null)

  function laden() {
    setRechnungen(ladeRechnungen())
    setProfile(ladeProfile())
    setMahnungen(ladeMahnungen())
  }
  useEffect(() => { laden() }, [])

  const mahnungenFuer = (r: Rechnung) =>
    mahnungen.filter((m) => m.rechnungId === r.id).sort((a, b) => a.stufeNr - b.stufeNr)

  // Offene Rechnungen mit fälliger Stufe oder bereits vorhandener Mahnung —
  // am längsten überfällige zuerst.
  const relevante = rechnungen
    .filter((r) => r.status === "offen")
    .filter((r) => profilFilter === "alle" || r.profilId === profilFilter)
    .filter((r) => naechsteFaelligeStufe(r, mahnungenFuer(r)) !== null || mahnungenFuer(r).length > 0)
    .sort((a, b) => tageSeitRechnung(b.rechnungsdatum) - tageSeitRechnung(a.rechnungsdatum))

  function neueMahnung(r: Rechnung, stufe: MahnStufe): Mahnung {
    return berechneMahnung(r, stufe, heuteDe())
  }

  async function erzeugen(r: Rechnung, stufe: MahnStufe) {
    const m = neueMahnung(r, stufe)
    speichereMahnung(m)
    laden()
    await erzeugeMahnungPdf(m, r)
    setToast(`${mahnStufeConfig(stufe).label} erstellt`)
  }

  function loeschen(m: Mahnung) {
    if (!window.confirm(`${mahnStufeConfig(m.stufe).label} vom ${m.mahndatum} löschen?`)) return
    loescheMahnung(m.id)
    laden()
    setToast("Mahnung gelöscht")
  }

  const profilName = (id: string) => profile.find((p) => p.id === id)?.name ?? "—"

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mahnungen</h1>
          <p className="text-sm text-muted mt-1">
            Überfällige Rechnungen anmahnen — die Original-Rechnung wird jeder Mahnung automatisch beigelegt.
          </p>
        </div>
        {profile.length > 1 && (
          <select
            value={profilFilter}
            onChange={(e) => setProfilFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="alle">Alle Profile</option>
            {profile.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {relevante.length === 0 ? (
        <div className="bg-surface border-2 border-dashed border-line rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-muted text-sm">
            Keine überfälligen Rechnungen. Sobald eine offene Rechnung die 14-Tage-Frist überschreitet,
            erscheint sie hier mit der fälligen Mahnstufe.
          </p>
          <Link href="/rechnungen" className="inline-block mt-4 text-brand hover:underline text-sm">
            Zu den Rechnungen →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {relevante.map((r) => {
            const historie = mahnungenFuer(r)
            const faellig = naechsteFaelligeStufe(r, historie)
            const brutto = rechnungSummen(r.positionen, r.kleinunternehmer).brutto
            const ueberfaelligTage = tageSeitRechnung(r.rechnungsdatum) - r.zahlungszielTage
            const vorschauMahnung = faellig ? neueMahnung(r, faellig.stufe) : null

            return (
              <div key={r.id} className="bg-surface border rounded-xl p-5 shadow-sm space-y-4">
                {/* Kopf */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Rechnung {r.rechnungsnummer}</h3>
                      <span className="text-xs text-faint">· {profilName(r.profilId)}</span>
                    </div>
                    <p className="text-sm text-muted">{r.empfaenger.name}</p>
                    <p className="text-xs text-faint mt-0.5">
                      Rechnungsdatum {r.rechnungsdatum}
                      {ueberfaelligTage > 0 && ` · überfällig seit ${ueberfaelligTage} Tagen`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-faint">Offener Betrag</div>
                    <div className="font-semibold">{formatEuro(brutto)}</div>
                  </div>
                </div>

                {/* Verlauf bereits erstellter Mahnungen */}
                {historie.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {historie.map((m) => (
                      <span
                        key={m.id}
                        className={`inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full ${STUFE_FARBE[m.stufe]}`}
                      >
                        {mahnStufeConfig(m.stufe).label} · {m.mahndatum}
                        <button
                          onClick={() => erzeugeMahnungPdf(m, r)}
                          title="PDF erneut herunterladen"
                          className="underline hover:no-underline"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => loeschen(m)}
                          title="Mahnung löschen"
                          className="hover:text-ink leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Fällige Stufe + Aktionen */}
                {faellig && vorschauMahnung ? (
                  <div className="border-t pt-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm">
                      <span className={`inline-block text-xs px-2.5 py-1 rounded-full mr-2 ${STUFE_FARBE[faellig.stufe]}`}>
                        {faellig.label} fällig
                      </span>
                      {vorschauMahnung.mahnkostenBetrag > 0 ? (
                        <span className="text-muted">
                          + {faellig.aufschlagProzent} % Mahnkosten ({formatEuro(vorschauMahnung.mahnkostenBetrag)}) →{" "}
                          <span className="font-semibold text-ink">
                            Gesamtforderung {formatEuro(vorschauMahnung.gesamtforderung)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">ohne Mahnkosten · neue Frist bis {vorschauMahnung.neuesZahlungsziel}</span>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setVorschau({ mahnung: vorschauMahnung, rechnung: r })}
                        className="text-brand hover:underline text-sm"
                      >
                        Vorschau
                      </button>
                      <button
                        onClick={() => erzeugen(r, faellig.stufe)}
                        className="bg-brand text-white px-4 py-1.5 rounded-lg hover:bg-brand-deep text-sm font-semibold"
                      >
                        {faellig.label} erstellen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-4 text-sm text-muted">
                    {historie.length > 0
                      ? "Alle fälligen Stufen erstellt — nächste Stufe noch nicht erreicht."
                      : "Noch keine Mahnstufe fällig."}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {vorschau && (
        <MahnungVorschauModal
          mahnung={vorschau.mahnung}
          rechnung={vorschau.rechnung}
          onClose={() => setVorschau(null)}
        />
      )}
    </div>
  )
}
