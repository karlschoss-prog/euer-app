"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Rechnung, Unternehmensprofil } from "@/types/beleg"
import { ladeRechnungen, ladeProfile, loescheRechnung, speichereRechnungMitBelegen } from "@/lib/storage"
import { rechnungSummen } from "@/lib/rechnung"
import { formatEuro } from "@/lib/formatierung"
import { erzeugeRechnungPdf } from "@/components/RechnungPdf"
import RechnungVorschauModal from "@/components/RechnungVorschauModal"
import Toast from "@/components/Toast"

function datumWert(de: string): number {
  const [d, m, y] = de.split(".")
  return new Date(Number(y), Number(m) - 1, Number(d)).getTime()
}

function deZuIso(de: string): string {
  if (!de || !de.includes(".")) return ""
  const [d, m, y] = de.split(".")
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

function isoZuDe(iso: string): string {
  if (!iso || !iso.includes("-")) return iso
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export default function RechnungenPage() {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([])
  const [profile, setProfile] = useState<Unternehmensprofil[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [profilFilter, setProfilFilter] = useState("alle")
  const [vorschau, setVorschau] = useState<Rechnung | null>(null)
  const [zahlModal, setZahlModal] = useState<Rechnung | null>(null)
  const [zahlDatumIso, setZahlDatumIso] = useState("")

  function laden() {
    setRechnungen(ladeRechnungen())
    setProfile(ladeProfile())
  }
  useEffect(() => { laden() }, [])

  function loeschen(r: Rechnung) {
    if (!window.confirm(`Rechnung ${r.rechnungsnummer} löschen? Die verknüpfte Einnahme wird ebenfalls entfernt.`)) return
    loescheRechnung(r.id)
    laden()
    setToast("Rechnung gelöscht")
  }

  function statusUmschalten(r: Rechnung) {
    if (r.status === "offen") {
      // Zahlungseingang: Datum abfragen ("wann ist es gekommen?")
      setZahlDatumIso(r.zahlungsdatum ? deZuIso(r.zahlungsdatum) : new Date().toISOString().split("T")[0])
      setZahlModal(r)
    } else {
      // zurück auf offen → verknüpfte Einnahme entfällt
      speichereRechnungMitBelegen({ ...r, status: "offen" })
      laden()
      setToast("Wieder als offen markiert")
    }
  }

  function zahlungBestaetigen() {
    if (!zahlModal) return
    speichereRechnungMitBelegen({ ...zahlModal, status: "bezahlt", zahlungsdatum: isoZuDe(zahlDatumIso) })
    setZahlModal(null)
    laden()
    setToast("Zahlungseingang verbucht")
  }

  const gefiltert = rechnungen
    .filter((r) => profilFilter === "alle" || r.profilId === profilFilter)
    .sort((a, b) => datumWert(b.rechnungsdatum) - datumWert(a.rechnungsdatum))

  const offene = gefiltert.filter((r) => r.status === "offen")
  const offeneSumme = offene.reduce((s, r) => s + rechnungSummen(r.positionen, r.kleinunternehmer).brutto, 0)

  const profilName = (id: string) => profile.find((p) => p.id === id)?.name ?? "—"

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rechnungen</h1>
          <p className="text-sm text-gray-500 mt-1">Erstellen, als PDF herunterladen und in der EÜR verbuchen.</p>
        </div>
        <Link href="/rechnungen/neu" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Neue Rechnung
        </Link>
      </div>

      {profile.length > 1 && (
        <select value={profilFilter} onChange={(e) => setProfilFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="alle">Alle Unternehmen</option>
          {profile.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      {/* Offene Forderungen (Soll) */}
      {rechnungen.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Offene Forderungen (Soll)</p>
            <p className="text-xs text-orange-600 mt-0.5">
              {offene.length} {offene.length === 1 ? "unbezahlte Rechnung" : "unbezahlte Rechnungen"} — noch nicht in der EÜR verbucht
            </p>
          </div>
          <span className="text-2xl font-bold text-orange-800">{formatEuro(offeneSumme)}</span>
        </div>
      )}

      {gefiltert.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">🧾</div>
          <p className="text-gray-500 text-sm mb-6">Noch keine Rechnungen erstellt.</p>
          <Link href="/rechnungen/neu" className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + Erste Rechnung erstellen
          </Link>
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nummer</th>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Empfänger</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Unternehmen</th>
                <th className="px-4 py-3 font-medium text-right">Betrag</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gefiltert.map((r) => {
                const { brutto } = rechnungSummen(r.positionen, r.kleinunternehmer)
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.rechnungsnummer}</td>
                    <td className="px-4 py-3 text-gray-500">{r.rechnungsdatum}</td>
                    <td className="px-4 py-3">{r.empfaenger.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{profilName(r.profilId)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatEuro(brutto)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => statusUmschalten(r)}
                        title={r.status === "bezahlt" ? "Auf „offen“ zurücksetzen" : "Als bezahlt verbuchen"}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                          r.status === "bezahlt"
                            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                            : "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200"
                        }`}
                      >
                        {r.status === "bezahlt" ? "Bezahlt" : "Offen"}
                        <span className="text-[9px] leading-none opacity-60">▾</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 justify-end text-xs">
                        <button onClick={() => setVorschau(r)} className="text-blue-600 hover:underline">Vorschau</button>
                        <button onClick={() => erzeugeRechnungPdf(r)} className="text-blue-600 hover:underline">PDF</button>
                        <Link href={`/rechnungen/neu?id=${r.id}`} className="text-gray-600 hover:underline">Bearbeiten</Link>
                        <button onClick={() => loeschen(r)} className="text-red-500 hover:underline">Löschen</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {vorschau && <RechnungVorschauModal rechnung={vorschau} onClose={() => setVorschau(null)} />}

      {/* Zahlungseingang-Datum */}
      {zahlModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setZahlModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Zahlungseingang verbuchen</h2>
            <p className="text-sm text-gray-500">
              Rechnung {zahlModal.rechnungsnummer} — wann ist das Geld gekommen? Erst dann wird die Einnahme in der EÜR erfasst.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Zahlungsdatum</label>
              <input
                type="date"
                value={zahlDatumIso}
                onChange={(e) => setZahlDatumIso(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={zahlungBestaetigen} className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                Als bezahlt verbuchen
              </button>
              <button onClick={() => setZahlModal(null)} className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
