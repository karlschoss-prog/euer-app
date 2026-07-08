"use client"

import { useState, useEffect } from "react"
import { ladeBelege, ladeStandardProfil } from "@/lib/storage"
import { berechneUstVoranmeldung, summiereUstPerioden, UstZeitraum, UstPeriode } from "@/lib/berechnung"
import { formatEuro } from "@/lib/formatierung"
import { Beleg } from "@/types/beleg"
import Toast from "@/components/Toast"

const ZEITRAUM_LABEL: Record<UstZeitraum, string> = {
  monat: "Monatlich",
  quartal: "Vierteljährlich",
  jahr: "Jährlich",
}

const ZR_KEY = "euer_ustva_zeitraum"

// ELSTER erwartet Bemessungsgrundlagen in vollen Euro (kaufmännisch abgerundet).
function volleEuro(betrag: number): number {
  return Math.floor(betrag + 0.0000001)
}

function periodeHatDaten(p: UstPeriode): boolean {
  return (
    p.kz81_netto !== 0 || p.kz86_netto !== 0 || p.kz35_netto !== 0 || p.kz66_vorsteuer !== 0
  )
}

// CSV mit Semikolon + deutschem Dezimalkomma (Excel-tauglich), inkl. BOM.
function baueCsv(perioden: UstPeriode[], gesamt: UstPeriode): string {
  const num = (n: number) => n.toFixed(2).replace(".", ",")
  const kopf = [
    "Zeitraum",
    "Kz 81 Umsätze 19% (netto)", "USt 19%",
    "Kz 86 Umsätze 7% (netto)", "USt 7%",
    "Kz 35 andere Sätze (netto)", "Kz 36 Steuer",
    "Umsatzsteuer gesamt",
    "Kz 66 Vorsteuer",
    "Kz 83 Zahllast",
  ]
  const zeile = (p: UstPeriode) => [
    p.label,
    num(p.kz81_netto), num(p.kz81_steuer),
    num(p.kz86_netto), num(p.kz86_steuer),
    num(p.kz35_netto), num(p.kz36_steuer),
    num(p.umsatzsteuer),
    num(p.kz66_vorsteuer),
    num(p.kz83_zahllast),
  ].join(";")
  const zeilen = [kopf.join(";"), ...perioden.map(zeile), zeile(gesamt)]
  return "﻿" + zeilen.join("\r\n")
}

export default function UmsatzsteuerPage() {
  const [jahr, setJahr] = useState(new Date().getFullYear())
  const [zeitraum, setZeitraum] = useState<UstZeitraum>("quartal")
  const [belege, setBelege] = useState<Beleg[]>([])
  const [kleinunternehmer, setKleinunternehmer] = useState(false)
  const [auswahl, setAuswahl] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    setBelege(ladeBelege())
    setKleinunternehmer(ladeStandardProfil()?.kleinunternehmer ?? false)
    const gespeichert = localStorage.getItem(ZR_KEY) as UstZeitraum | null
    if (gespeichert === "monat" || gespeichert === "quartal" || gespeichert === "jahr") {
      setZeitraum(gespeichert)
    }
  }, [])

  function waehleZeitraum(z: UstZeitraum) {
    setZeitraum(z)
    setAuswahl(null)
    localStorage.setItem(ZR_KEY, z)
  }

  const perioden = berechneUstVoranmeldung(belege, jahr, zeitraum)
  const gesamt = summiereUstPerioden(perioden)
  const hatSonstige = perioden.some((p) => p.kz35_netto !== 0)

  // Detail-Periode: gewählte, sonst letzte mit Daten, sonst erste.
  const detailIndex =
    auswahl ?? [...perioden].reverse().find(periodeHatDaten)?.index ?? perioden[0]?.index ?? null
  const detail = perioden.find((p) => p.index === detailIndex) ?? null

  function exportCsv() {
    const csv = baueCsv(perioden, gesamt)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ustva-${jahr}-${zeitraum}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setToast("CSV heruntergeladen")
  }

  async function kopiereKennziffern() {
    if (!detail) return
    const zeilen = [
      `UStVA ${detail.label} ${jahr}`,
      `Kz 81 (Umsätze 19 %): ${volleEuro(detail.kz81_netto)} €  →  USt ${detail.kz81_steuer.toFixed(2).replace(".", ",")} €`,
      `Kz 86 (Umsätze 7 %):  ${volleEuro(detail.kz86_netto)} €  →  USt ${detail.kz86_steuer.toFixed(2).replace(".", ",")} €`,
    ]
    if (detail.kz35_netto !== 0) {
      zeilen.push(`Kz 35/36 (andere Sätze): ${volleEuro(detail.kz35_netto)} € → USt ${detail.kz36_steuer.toFixed(2).replace(".", ",")} €`)
    }
    zeilen.push(
      `Kz 66 (Vorsteuer): ${detail.kz66_vorsteuer.toFixed(2).replace(".", ",")} €`,
      `Kz 83 (Zahllast): ${detail.kz83_zahllast.toFixed(2).replace(".", ",")} €`
    )
    try {
      await navigator.clipboard.writeText(zeilen.join("\n"))
      setToast("Kennziffern kopiert")
    } catch {
      setToast("Kopieren nicht möglich")
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Umsatzsteuer-Voranmeldung</h1>
          <p className="text-sm text-muted mt-0.5">
            Auswertung nach vereinnahmten Entgelten (Ist-Versteuerung)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setJahr((j) => j - 1)} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2">‹</button>
          <span className="font-semibold text-lg w-16 text-center">{jahr}</span>
          <button onClick={() => setJahr((j) => j + 1)} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2">›</button>
        </div>
      </div>

      {kleinunternehmer && (
        <div className="bg-warn-tint border border-warn-line rounded-xl px-5 py-3 text-sm text-warn flex items-start gap-2">
          <span>ℹ️</span>
          <span>
            Dein Standardprofil ist als <strong>Kleinunternehmer (§19 UStG)</strong> gekennzeichnet — dann
            gibst du keine Umsatzsteuer-Voranmeldung ab. Diese Auswertung ist nur bei Regelbesteuerung relevant.
          </span>
        </div>
      )}

      {/* Zeitraum-Umschalter */}
      <div className="inline-flex rounded-lg border border-line bg-surface p-1">
        {(Object.keys(ZEITRAUM_LABEL) as UstZeitraum[]).map((z) => (
          <button
            key={z}
            onClick={() => waehleZeitraum(z)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              zeitraum === z ? "bg-brand text-white shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {ZEITRAUM_LABEL[z]}
          </button>
        ))}
      </div>

      {/* Übersichtstabelle */}
      <div className="bg-surface border rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-surface-2 text-left">
              <th className="px-4 py-3 font-semibold">Zeitraum</th>
              <th className="px-4 py-3 font-semibold text-right">
                Umsätze 19 %<span className="block text-xs font-normal text-faint">Kz 81 · netto</span>
              </th>
              <th className="px-4 py-3 font-semibold text-right">USt 19 %</th>
              <th className="px-4 py-3 font-semibold text-right">
                Umsätze 7 %<span className="block text-xs font-normal text-faint">Kz 86 · netto</span>
              </th>
              <th className="px-4 py-3 font-semibold text-right">USt 7 %</th>
              {hatSonstige && <th className="px-4 py-3 font-semibold text-right">Andere<span className="block text-xs font-normal text-faint">Kz 35/36</span></th>}
              <th className="px-4 py-3 font-semibold text-right text-neg">Vorsteuer<span className="block text-xs font-normal text-faint">Kz 66</span></th>
              <th className="px-4 py-3 font-semibold text-right text-brand-ink">Zahllast<span className="block text-xs font-normal text-faint">Kz 83</span></th>
            </tr>
          </thead>
          <tbody>
            {perioden.map((p) => {
              const hatDaten = periodeHatDaten(p)
              const aktiv = p.index === detailIndex
              return (
                <tr
                  key={p.index}
                  onClick={() => hatDaten && setAuswahl(p.index)}
                  className={`border-t transition-colors ${
                    hatDaten ? "cursor-pointer hover:bg-brand-tint" : "text-faint"
                  } ${aktiv && hatDaten ? "bg-brand-tint" : ""}`}
                >
                  <td className="px-4 py-2.5 font-medium">{p.label}</td>
                  <td className="px-4 py-2.5 text-right tnum">{hatDaten ? formatEuro(p.kz81_netto) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">{p.kz81_steuer ? formatEuro(p.kz81_steuer) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tnum">{p.kz86_netto ? formatEuro(p.kz86_netto) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">{p.kz86_steuer ? formatEuro(p.kz86_steuer) : "—"}</td>
                  {hatSonstige && <td className="px-4 py-2.5 text-right tnum">{p.kz36_steuer ? formatEuro(p.kz36_steuer) : "—"}</td>}
                  <td className="px-4 py-2.5 text-right tnum text-neg">{p.kz66_vorsteuer ? formatEuro(p.kz66_vorsteuer) : "—"}</td>
                  <td className={`px-4 py-2.5 text-right tnum font-medium ${!hatDaten ? "" : p.kz83_zahllast >= 0 ? "text-brand-ink" : "text-pos"}`}>
                    {hatDaten ? formatEuro(p.kz83_zahllast) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-surface-2 font-bold">
              <td className="px-4 py-3">Gesamt {jahr}</td>
              <td className="px-4 py-3 text-right tnum">{formatEuro(gesamt.kz81_netto)}</td>
              <td className="px-4 py-3 text-right tnum">{formatEuro(gesamt.kz81_steuer)}</td>
              <td className="px-4 py-3 text-right tnum">{formatEuro(gesamt.kz86_netto)}</td>
              <td className="px-4 py-3 text-right tnum">{formatEuro(gesamt.kz86_steuer)}</td>
              {hatSonstige && <td className="px-4 py-3 text-right tnum">{formatEuro(gesamt.kz36_steuer)}</td>}
              <td className="px-4 py-3 text-right tnum text-neg">{formatEuro(gesamt.kz66_vorsteuer)}</td>
              <td className="px-4 py-3 text-right tnum text-brand-ink">{formatEuro(gesamt.kz83_zahllast)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ELSTER-Kennziffern für gewählten Zeitraum */}
      {detail && (
        <div className="bg-surface border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              ELSTER-Kennziffern · <span className="text-brand-ink">{detail.label} {jahr}</span>
            </h2>
            <button
              onClick={kopiereKennziffern}
              className="text-xs bg-surface-2 text-ink-soft px-3 py-1.5 rounded-lg hover:bg-line font-medium"
            >
              Kennziffern kopieren
            </button>
          </div>
          <p className="text-xs text-muted">
            Bemessungsgrundlagen sind für ELSTER auf volle Euro abgerundet; die Steuer wird cent-genau berechnet.
          </p>
          <div className="grid gap-2">
            <KzZeile kz="81" label="Umsätze zu 19 %" netto={volleEuro(detail.kz81_netto)} steuer={detail.kz81_steuer} />
            <KzZeile kz="86" label="Umsätze zu 7 %" netto={volleEuro(detail.kz86_netto)} steuer={detail.kz86_steuer} />
            {detail.kz35_netto !== 0 && (
              <KzZeile kz="35/36" label="Umsätze zu anderen Sätzen" netto={volleEuro(detail.kz35_netto)} steuer={detail.kz36_steuer} />
            )}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-2">
              <span className="text-sm"><span className="font-mono text-xs bg-surface border rounded px-1.5 py-0.5 mr-2">66</span>Abziehbare Vorsteuer</span>
              <span className="tnum font-medium text-neg">{formatEuro(detail.kz66_vorsteuer)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-brand-tint border border-line">
              <span className="text-sm font-semibold"><span className="font-mono text-xs bg-surface border rounded px-1.5 py-0.5 mr-2">83</span>{detail.kz83_zahllast >= 0 ? "Verbleibende Vorauszahlung (Zahllast)" : "Verbleibender Überschuss"}</span>
              <span className="tnum font-bold text-brand-ink">{formatEuro(detail.kz83_zahllast)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Fußnote + Export */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-faint max-w-lg">
          Grundlage sind die erfassten Belege des Jahres nach Beleg-/Zahlungsdatum. Angaben ohne Gewähr —
          bitte vor Übermittlung an ELSTER prüfen. Steuerfreie Umsätze und §19-Belege (0 %) erscheinen nicht.
        </p>
        <button
          onClick={exportCsv}
          className="bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium shrink-0"
        >
          Als CSV exportieren
        </button>
      </div>
    </div>
  )
}

function KzZeile({ kz, label, netto, steuer }: { kz: string; label: string; netto: number; steuer: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-2">
      <span className="text-sm">
        <span className="font-mono text-xs bg-surface border rounded px-1.5 py-0.5 mr-2">{kz}</span>
        {label}
      </span>
      <span className="flex items-baseline gap-4">
        <span className="tnum text-ink-soft">{netto.toLocaleString("de-DE")} €</span>
        <span className="tnum text-xs text-muted w-28 text-right">USt {formatEuro(steuer)}</span>
      </span>
    </div>
  )
}
