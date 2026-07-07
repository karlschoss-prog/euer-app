"use client"

import { useState, useId } from "react"
import { BelegTyp, Beleg, Vorlage } from "@/types/beleg"
import { formatEuro } from "@/lib/formatierung"

const KATEGORIEN = [
  "Büromaterial", "Software & Lizenzen", "Reisekosten", "Bewirtung",
  "Telefon & Internet", "Miete & Nebenkosten", "Marketing & Werbung",
  "Fortbildung & Literatur", "Fahrzeugkosten", "Versicherungen",
  "Beratung & Honorare", "Sonstiges",
]

export interface BelegFormData {
  datum: string           // TT.MM.JJJJ
  belegnummer?: string
  kunde_lieferant?: string
  leistungsbeschreibung: string
  menge: number
  einzelpreis: number
  mwst_satz: number
  kategorie?: string
}

interface BelegFormProps {
  typ: BelegTyp
  onSpeichern: (data: BelegFormData) => void
  initialData?: Beleg
  vorlagen?: Vorlage[]
  naechsteBelegnummer?: string
}

function parsePreis(wert: string): number {
  return parseFloat(wert.replace(/\./g, "").replace(",", ".")) || 0
}

function deutschZuISO(datum: string): string {
  if (!datum || !datum.includes(".")) return ""
  const [d, m, y] = datum.split(".")
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

function isoZuDeutsch(iso: string): string {
  if (!iso || !iso.includes("-")) return ""
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export default function BelegForm({ typ, onSpeichern, initialData, vorlagen = [], naechsteBelegnummer }: BelegFormProps) {
  const listId = useId()
  const istAusgabe = typ === "ausgabe"
  const label = typ === "einnahme" ? "Kundenname" : "Lieferant"
  const typVorlagen = vorlagen.filter((v) => v.typ === typ)
  const istEdit = !!initialData

  // Bei Ausgaben gibt der Nutzer den Brutto-Einzelpreis ein; intern (und in der
  // EÜR) wird mit Netto gerechnet. Beim Bearbeiten den Netto-Wert zurück in Brutto wandeln.
  const initialEinzelpreis = initialData
    ? istAusgabe
      ? initialData.einzelpreis * (1 + initialData.mwst_satz / 100)
      : initialData.einzelpreis
    : 0

  const [datum, setDatum] = useState(initialData ? deutschZuISO(initialData.datum) : "")
  const [belegnummer, setBelegnummer] = useState(initialData?.belegnummer ?? naechsteBelegnummer ?? "")
  const [kundeLieferant, setKundeLieferant] = useState(initialData?.kunde_lieferant ?? "")
  const [leistung, setLeistung] = useState(initialData?.leistungsbeschreibung ?? "")
  const [menge, setMenge] = useState<number>(initialData?.menge ?? 0)
  const [einzelpreis, setEinzelpreis] = useState<number>(initialEinzelpreis)
  const [einzelpreisText, setEinzelpreisText] = useState(
    initialData ? initialEinzelpreis.toFixed(2).replace(".", ",") : ""
  )
  const [mwstSatz, setMwstSatz] = useState(initialData?.mwst_satz ?? (typ === "einnahme" ? 0 : 19))
  const [kategorie, setKategorie] = useState(initialData?.kategorie ?? "")

  // einzelpreis = Eingabewert (Brutto bei Ausgabe, sonst Netto). Netto je Einheit ableiten.
  const nettoEinzel = istAusgabe ? einzelpreis / (1 + mwstSatz / 100) : einzelpreis
  const netto = menge * nettoEinzel
  const mwstBetrag = netto * (mwstSatz / 100)
  const brutto = netto + mwstBetrag

  function ladeVorlage(id: string) {
    const v = typVorlagen.find((v) => v.id === id)
    if (!v) return
    setLeistung(v.leistungsbeschreibung)
    setKundeLieferant(v.kunde_lieferant ?? "")
    setMenge(v.menge)
    // Vorlage speichert Netto; bei Ausgaben als Brutto ins Eingabefeld
    const einzel = istAusgabe ? v.einzelpreis * (1 + v.mwst_satz / 100) : v.einzelpreis
    setEinzelpreis(einzel)
    setEinzelpreisText(einzel.toFixed(2).replace(".", ","))
    setMwstSatz(v.mwst_satz)
    setKategorie(v.kategorie ?? "")
  }

  function reset() {
    setDatum(""); setBelegnummer(""); setKundeLieferant(""); setLeistung("")
    setMenge(0); setEinzelpreis(0); setEinzelpreisText(""); setMwstSatz(19); setKategorie("")
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSpeichern({
      datum: isoZuDeutsch(datum),
      belegnummer: belegnummer.trim() || undefined,
      kunde_lieferant: kundeLieferant.trim() || undefined,
      leistungsbeschreibung: leistung,
      menge,
      einzelpreis: nettoEinzel,
      mwst_satz: mwstSatz,
      kategorie: kategorie.trim() || undefined,
    })
    if (!istEdit) reset()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {typVorlagen.length > 0 && (
        <div className="flex items-center gap-3 pb-3 mb-1 border-b border-line">
          <span className="text-xs font-semibold text-faint uppercase tracking-wide shrink-0">Vorlage laden</span>
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) ladeVorlage(e.target.value) }}
            className="bg-surface border border-line text-ink rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs"
          >
            <option value="">— auswählen —</option>
            {typVorlagen.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Datum</label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            required
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Belegnummer <span className="text-faint font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={belegnummer}
            onChange={(e) => setBelegnummer(e.target.value)}
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {label} <span className="text-faint font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={kundeLieferant}
            onChange={(e) => setKundeLieferant(e.target.value)}
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Leistungsbeschreibung</label>
          <input
            type="text"
            value={leistung}
            onChange={(e) => setLeistung(e.target.value)}
            required
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Menge</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={menge || ""}
            onChange={(e) => setMenge(parseFloat(e.target.value) || 0)}
            required
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {istAusgabe ? "Einzelpreis Brutto (€)" : "Einzelpreis Netto (€)"}
          </label>
          <input
            type="text"
            placeholder="0,00"
            value={einzelpreisText}
            onChange={(e) => { setEinzelpreisText(e.target.value); setEinzelpreis(parsePreis(e.target.value)) }}
            required
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">MwSt-Satz</label>
          <select
            value={mwstSatz}
            onChange={(e) => setMwstSatz(parseInt(e.target.value))}
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          >
            <option value="19">19 %</option>
            {istAusgabe && <option value="7">7 %</option>}
            <option value="0">0 %</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kategorie (optional)</label>
          <input
            type="text"
            list={listId}
            value={kategorie}
            onChange={(e) => setKategorie(e.target.value)}
            placeholder="Auswählen oder eingeben…"
            className="w-full bg-surface border border-line text-ink rounded-lg px-3 py-2 text-sm placeholder:text-faint"
          />
          <datalist id={listId}>
            {KATEGORIEN.map((k) => <option key={k} value={k} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-brand-ink">
            {istAusgabe ? "Netto (für EÜR)" : "Gesamtpreis Brutto"}
          </label>
          {istAusgabe ? (
            <div className="px-1 py-1">
              <p className="text-2xl font-bold text-brand-ink tnum">{formatEuro(netto)}</p>
              <p className="text-xs text-muted mt-0.5 tnum">
                enth. MwSt {formatEuro(mwstBetrag)} · Brutto {formatEuro(brutto)}
              </p>
            </div>
          ) : (
            <p className="px-1 py-2 text-2xl font-bold text-brand-ink tnum">{formatEuro(brutto)}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="bg-brand text-white px-6 py-2.5 rounded-lg hover:bg-brand-deep text-sm font-semibold shadow-card"
      >
        {istEdit ? "Änderungen speichern" : typ === "einnahme" ? "Einnahme speichern" : "Ausgabe speichern"}
      </button>
    </form>
  )
}
