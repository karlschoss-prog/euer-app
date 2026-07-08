"use client"

import { useState, useEffect, useRef } from "react"
import BelegForm, { BelegFormData } from "@/components/BelegForm"
import Toast from "@/components/Toast"
import { Beleg, Anhang } from "@/types/beleg"
import {
  InboxItem, ladeInboxItems, speichereInboxRecord, loescheInboxItem,
  oeffneInboxItem, ladeInboxBlob,
} from "@/lib/inbox"
import { parseERechnungDatei, ERechnungDaten } from "@/lib/erechnung"
import { speichereAnhangBlob } from "@/lib/anhaenge"
import { speichereBeleg } from "@/lib/storage"
import { formatEuro } from "@/lib/formatierung"
import { v4 as uuidv4 } from "uuid"

function formatGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function icon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼️"
  if (mime === "application/pdf") return "📄"
  if (mime.includes("xml")) return "🧾"
  return "📎"
}

// Baut ein vorausgefülltes (Ausgabe-)Formular aus dem Inbox-Element.
function buildPrefill(item: InboxItem, anhang: Anhang): { prefill: Beleg; mehrfachSatz: boolean } {
  const e = item.erechnung
  let datum = ""
  let belegnummer: string | undefined
  let kunde: string | undefined
  let leistung = ""
  let einzelpreisNetto = 0
  let satz = 19
  let mehrfachSatz = false

  if (e) {
    datum = e.rechnungsdatum ?? ""
    belegnummer = e.rechnungsnummer
    kunde = e.verkaeufer
    const gruppen = e.mwstGruppen.length
      ? e.mwstGruppen
      : [{ satz: 19, netto: e.nettoGesamt, steuer: e.steuerGesamt }]
    mehrfachSatz = gruppen.length > 1
    const leit = [...gruppen].sort((a, b) => b.netto - a.netto)[0]
    satz = Math.round(leit.satz)
    einzelpreisNetto = leit.netto
    leistung = e.rechnungsnummer
      ? `Rechnung ${e.rechnungsnummer}`
      : `E-Rechnung von ${e.verkaeufer ?? "Lieferant"}`
  }

  const prefill: Beleg = {
    id: "prefill",
    typ: "ausgabe",
    datum,
    belegnummer,
    kunde_lieferant: kunde,
    leistungsbeschreibung: leistung,
    menge: 1,
    einzelpreis: einzelpreisNetto, // NETTO je Einheit — BelegForm rechnet für Ausgaben in Brutto um
    gesamtpreis: einzelpreisNetto,
    mwst_satz: satz,
    nettobetrag: einzelpreisNetto,
    bruttobetrag: einzelpreisNetto * (1 + satz / 100),
    erstellt_am: new Date().toISOString(),
    anhaenge: [anhang],
  }
  return { prefill, mehrfachSatz }
}

interface BuchungState {
  inboxId: string
  prefill: Beleg
  mehrfachSatz: boolean
  erechnung: ERechnungDaten | null
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [dragAktiv, setDragAktiv] = useState(false)
  const [verarbeite, setVerarbeite] = useState(false)
  const [buchung, setBuchung] = useState<BuchungState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function laden() {
    setItems(await ladeInboxItems())
  }
  useEffect(() => { laden() }, [])

  async function verarbeiteDateien(files: File[]) {
    if (files.length === 0) return
    setVerarbeite(true)
    for (const f of files) {
      let erechnung: ERechnungDaten | null = null
      try { erechnung = await parseERechnungDatei(f) } catch { erechnung = null }
      const item: InboxItem = {
        id: uuidv4(),
        name: f.name,
        mime: f.type || "application/octet-stream",
        groesse: f.size,
        erstellt_am: new Date().toISOString(),
        erechnung,
      }
      await speichereInboxRecord(item, f)
    }
    setVerarbeite(false)
    await laden()
    const erkannt = files.length
    setToast(erkannt === 1 ? "Datei hinzugefügt" : `${erkannt} Dateien hinzugefügt`)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragAktiv(false)
    verarbeiteDateien(Array.from(e.dataTransfer.files))
  }

  async function starteBuchung(item: InboxItem) {
    const blob = await ladeInboxBlob(item.id)
    if (!blob) { setToast("Datei nicht gefunden"); return }
    const anhang: Anhang = {
      id: uuidv4(),
      name: item.name,
      mime: item.mime,
      groesse: item.groesse,
      erstellt_am: new Date().toISOString(),
      quelle: item.erechnung ? "e-rechnung" : "inbox",
    }
    // Blob in den Anhang-Store übernehmen (BelegForm erwartet bestehende Anhänge dort).
    await speichereAnhangBlob(anhang.id, blob)
    const { prefill, mehrfachSatz } = buildPrefill(item, anhang)
    setBuchung({ inboxId: item.id, prefill, mehrfachSatz, erechnung: item.erechnung })
  }

  async function bucheAusInbox(data: BelegFormData) {
    if (!buchung) return
    const netto = data.menge * data.einzelpreis
    const beleg: Beleg = {
      id: uuidv4(),
      typ: "ausgabe",
      ...data,
      gesamtpreis: netto,
      nettobetrag: netto,
      bruttobetrag: netto * (1 + data.mwst_satz / 100),
      erstellt_am: new Date().toISOString(),
    }
    speichereBeleg(beleg)
    await loescheInboxItem(buchung.inboxId)
    setBuchung(null)
    await laden()
    setToast("Als Ausgabe gebucht")
  }

  async function verwerfen(item: InboxItem) {
    if (!window.confirm(`„${item.name}“ aus der Inbox entfernen?`)) return
    await loescheInboxItem(item.id)
    await laden()
    setToast("Aus Inbox entfernt")
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold">Beleg-Inbox</h1>
        <p className="text-sm text-muted mt-0.5">
          Belege reinziehen → automatisch auswerten → als Ausgabe buchen. E-Rechnungen (XRechnung/ZUGFeRD)
          werden ausgelesen und vorausgefüllt; Fotos/Scans buchst du manuell mit Beleg als Anhang.
        </p>
      </div>

      {/* Drop-Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragAktiv(true) }}
        onDragLeave={() => setDragAktiv(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-2xl px-6 py-10 text-center transition-colors ${
          dragAktiv ? "border-brand bg-brand-tint" : "border-line hover:border-line-strong bg-surface"
        }`}
      >
        <div className="text-3xl mb-2">📥</div>
        <p className="text-sm font-medium text-ink-soft">
          Dateien hierher ziehen oder klicken zum Auswählen
        </p>
        <p className="text-xs text-faint mt-1">Foto (JPG/PNG), PDF oder E-Rechnung (XML / ZUGFeRD-PDF)</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.xml"
          multiple
          onChange={(e) => { verarbeiteDateien(Array.from(e.target.files ?? [])); e.target.value = "" }}
          className="hidden"
        />
      </div>

      {verarbeite && <p className="text-sm text-muted">Werte Dateien aus…</p>}

      {/* Liste */}
      {items.length === 0 ? (
        <p className="text-sm text-faint">Die Inbox ist leer.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const e = item.erechnung
            return (
              <li key={item.id} className="bg-surface border rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{icon(item.mime)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => oeffneInboxItem(item.id, item.name)}
                        className="font-medium text-brand hover:underline truncate max-w-xs text-left"
                        title="Datei ansehen"
                      >
                        {item.name}
                      </button>
                      <span className="text-xs text-faint">{formatGroesse(item.groesse)}</span>
                      {e ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-pos-tint text-pos font-medium">
                          ✓ E-Rechnung erkannt ({e.syntax.toUpperCase()}{e.ausPdf ? "/ZUGFeRD" : ""})
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-muted font-medium">
                          Kein E-Rechnung-XML — manuell buchen
                        </span>
                      )}
                    </div>

                    {e && (
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                        <Feld label="Lieferant" wert={e.verkaeufer} />
                        <Feld label="Datum" wert={e.rechnungsdatum} />
                        <Feld label="Nummer" wert={e.rechnungsnummer} />
                        <Feld label="Brutto" wert={e.bruttoGesamt ? formatEuro(e.bruttoGesamt) : undefined} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => starteBuchung(item)}
                      className="bg-brand text-white px-4 py-1.5 rounded-lg hover:bg-brand-deep text-xs font-semibold"
                    >
                      Buchen
                    </button>
                    <button
                      onClick={() => verwerfen(item)}
                      className="text-neg hover:opacity-80 text-xs px-2 py-1"
                    >
                      Verwerfen
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Buchen-Modal */}
      {buchung && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(ev) => { if (ev.target === ev.currentTarget) setBuchung(null) }}
        >
          <div className="bg-surface border border-line rounded-2xl shadow-card-lg w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-ink">Aus Inbox als Ausgabe buchen</h2>
              <button onClick={() => setBuchung(null)} className="text-faint hover:text-ink text-xl leading-none">✕</button>
            </div>

            {buchung.mehrfachSatz && (
              <div className="mb-4 bg-warn-tint border border-warn-line rounded-lg px-4 py-2.5 text-xs text-warn">
                Diese Rechnung enthält mehrere Steuersätze. Vorausgefüllt ist die größte Position; weitere
                Steuersätze bitte als separate Ausgabe erfassen (der Anhang liegt dann bei dieser Buchung).
              </div>
            )}

            <BelegForm typ="ausgabe" prefill={buchung.prefill} onSpeichern={bucheAusInbox} />
          </div>
        </div>
      )}
    </div>
  )
}

function Feld({ label, wert }: { label: string; wert?: string }) {
  return (
    <div className="truncate">
      <span className="text-faint">{label}: </span>
      <span className="text-ink-soft font-medium">{wert || "—"}</span>
    </div>
  )
}
