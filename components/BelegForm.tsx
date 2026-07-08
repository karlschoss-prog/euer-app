"use client"

import { useState, useId } from "react"
import { BelegTyp, Beleg, Vorlage, Anhang } from "@/types/beleg"
import { formatEuro } from "@/lib/formatierung"
import { speichereAnhangBlob, loescheAnhangBlob, oeffneAnhang } from "@/lib/anhaenge"
import { v4 as uuidv4 } from "uuid"

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
  anhaenge?: Anhang[]
}

function formatGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function anhangIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼️"
  if (mime === "application/pdf") return "📄"
  if (mime.includes("xml")) return "🧾"
  return "📎"
}

interface BelegFormProps {
  typ: BelegTyp
  onSpeichern: (data: BelegFormData) => void
  initialData?: Beleg    // Bearbeiten eines bestehenden Belegs (Edit-Modus)
  prefill?: Beleg        // vorausgefülltes NEUES Formular (z. B. aus der Inbox) — kein Edit
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

export default function BelegForm({ typ, onSpeichern, initialData, prefill, vorlagen = [], naechsteBelegnummer }: BelegFormProps) {
  const listId = useId()
  const istAusgabe = typ === "ausgabe"
  const label = typ === "einnahme" ? "Kundenname" : "Lieferant"
  const typVorlagen = vorlagen.filter((v) => v.typ === typ)
  const istEdit = !!initialData
  // Startwerte kommen aus initialData (Edit) oder prefill (neues, vorausgefülltes Formular).
  const basis = initialData ?? prefill

  // Bei Ausgaben gibt der Nutzer den Brutto-Einzelpreis ein; intern (und in der
  // EÜR) wird mit Netto gerechnet. Beim Bearbeiten/Vorbefüllen den Netto-Wert zurück in Brutto wandeln.
  const initialEinzelpreis = basis
    ? istAusgabe
      ? basis.einzelpreis * (1 + basis.mwst_satz / 100)
      : basis.einzelpreis
    : 0

  const [datum, setDatum] = useState(basis ? deutschZuISO(basis.datum) : "")
  const [belegnummer, setBelegnummer] = useState(basis?.belegnummer ?? naechsteBelegnummer ?? "")
  const [kundeLieferant, setKundeLieferant] = useState(basis?.kunde_lieferant ?? "")
  const [leistung, setLeistung] = useState(basis?.leistungsbeschreibung ?? "")
  const [menge, setMenge] = useState<number>(basis?.menge ?? 0)
  const [einzelpreis, setEinzelpreis] = useState<number>(initialEinzelpreis)
  const [einzelpreisText, setEinzelpreisText] = useState(
    basis ? initialEinzelpreis.toFixed(2).replace(".", ",") : ""
  )
  const [mwstSatz, setMwstSatz] = useState(basis?.mwst_satz ?? (typ === "einnahme" ? 0 : 19))
  const [kategorie, setKategorie] = useState(basis?.kategorie ?? "")

  // Anhänge: bereits gespeicherte (aus initialData/prefill) vs. neu gewählte Dateien.
  // Persistiert/gelöscht wird erst beim Absenden, damit keine verwaisten Blobs entstehen.
  const [bestehende, setBestehende] = useState<Anhang[]>(basis?.anhaenge ?? [])
  const [neueDateien, setNeueDateien] = useState<File[]>([])
  const [entfernteIds, setEntfernteIds] = useState<string[]>([])
  const fileInputId = useId()

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
    setBestehende([]); setNeueDateien([]); setEntfernteIds([])
  }

  function handleDateiWahl(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) setNeueDateien((prev) => [...prev, ...files])
    e.target.value = "" // gleiche Datei erneut wählbar machen
  }

  function entferneBestehend(id: string) {
    setBestehende((prev) => prev.filter((a) => a.id !== id))
    setEntfernteIds((prev) => [...prev, id])
  }

  function entferneNeu(index: number) {
    setNeueDateien((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // entfernte bestehende Anhänge endgültig aus dem Blob-Store löschen
    for (const id of entfernteIds) await loescheAnhangBlob(id)
    // neu gewählte Dateien in IndexedDB persistieren und Metadaten erzeugen
    const neueMetas: Anhang[] = []
    for (const f of neueDateien) {
      const id = uuidv4()
      await speichereAnhangBlob(id, f)
      neueMetas.push({
        id,
        name: f.name,
        mime: f.type || "application/octet-stream",
        groesse: f.size,
        erstellt_am: new Date().toISOString(),
        quelle: "upload",
      })
    }
    const anhaenge = [...bestehende, ...neueMetas]
    onSpeichern({
      datum: isoZuDeutsch(datum),
      belegnummer: belegnummer.trim() || undefined,
      kunde_lieferant: kundeLieferant.trim() || undefined,
      leistungsbeschreibung: leistung,
      menge,
      einzelpreis: nettoEinzel,
      mwst_satz: mwstSatz,
      kategorie: kategorie.trim() || undefined,
      anhaenge: anhaenge.length ? anhaenge : undefined,
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

      {/* Beleganhänge (Foto/PDF) — GoBD-Originalbeleg */}
      <div className="border-t border-line pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor={fileInputId} className="block text-sm font-medium">
            Belege anhängen <span className="text-faint font-normal">(Foto/PDF, optional)</span>
          </label>
          <label
            htmlFor={fileInputId}
            className="cursor-pointer text-xs bg-surface-2 text-ink-soft px-3 py-1.5 rounded-lg hover:bg-line font-medium border border-line"
          >
            + Datei wählen
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/*,application/pdf,.xml"
            multiple
            onChange={handleDateiWahl}
            className="hidden"
          />
        </div>

        {(bestehende.length > 0 || neueDateien.length > 0) && (
          <ul className="space-y-1.5">
            {bestehende.map((a) => (
              <li key={a.id} className="flex items-center gap-2 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm">
                <span>{anhangIcon(a.mime)}</span>
                <button
                  type="button"
                  onClick={() => oeffneAnhang(a.id, a.name)}
                  className="flex-1 text-left text-brand hover:underline truncate"
                  title="Anhang ansehen"
                >
                  {a.name}
                </button>
                <span className="text-xs text-faint shrink-0">{formatGroesse(a.groesse)}</span>
                <button
                  type="button"
                  onClick={() => entferneBestehend(a.id)}
                  className="text-xs text-neg hover:opacity-80 shrink-0"
                  title="Anhang entfernen"
                >
                  ✕
                </button>
              </li>
            ))}
            {neueDateien.map((f, i) => (
              <li key={`neu-${i}`} className="flex items-center gap-2 bg-brand-tint border border-line rounded-lg px-3 py-2 text-sm">
                <span>{anhangIcon(f.type)}</span>
                <span className="flex-1 truncate text-ink-soft">{f.name}</span>
                <span className="text-xs text-brand shrink-0">neu</span>
                <span className="text-xs text-faint shrink-0">{formatGroesse(f.size)}</span>
                <button
                  type="button"
                  onClick={() => entferneNeu(i)}
                  className="text-xs text-neg hover:opacity-80 shrink-0"
                  title="Datei entfernen"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
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
