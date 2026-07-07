"use client"

import { Beleg } from "@/types/beleg"
import { formatEuro } from "@/lib/formatierung"
import { berechneMonatsEuer, berechneJahresEuer } from "@/lib/berechnung"

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

interface PdfExportProps {
  belege: Beleg[]
  monat: number
  jahr: number
  modus?: "monat" | "jahr"
}

export default function PdfExport({ belege, monat, jahr, modus = "monat" }: PdfExportProps) {
  async function handleExport() {
    const { default: jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    if (modus === "jahr") {
      await exportJahr(doc, autoTable, belege, jahr)
    } else {
      await exportMonat(doc, autoTable, belege, monat, jahr)
    }
  }

  async function exportMonat(doc: InstanceType<typeof import("jspdf").default>, autoTable: typeof import("jspdf-autotable").default, belege: Beleg[], monat: number, jahr: number) {
    const { default: jsPDF } = await import("jspdf")

    const titel = `EÜR-Monatsübersicht – ${MONATE[monat - 1]} ${jahr}`
    doc.setFontSize(14)
    doc.text(titel, 14, 20)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, 14, 27)
    doc.setTextColor(0)

    const gefiltert = belege
      .filter((b) => {
        const [, mon, j] = b.datum.split(".")
        return parseInt(mon) === monat && parseInt(j) === jahr
      })
      .sort((a, b) => {
        const [tA, mA, jA] = a.datum.split(".")
        const [tB, mB, jB] = b.datum.split(".")
        return new Date(`${jA}-${mA}-${tA}`).getTime() - new Date(`${jB}-${mB}-${tB}`).getTime()
      })

    const { einnahmen, ausgaben, ueberschuss } = berechneMonatsEuer(belege, monat, jahr)

    autoTable(doc, {
      startY: 32,
      head: [["Datum", "Beleg-Nr.", "Typ", "Beschreibung", "Einzelpreis", "Menge", "Netto", "MwSt", "Brutto"]],
      body: gefiltert.map((b) => [
        b.datum,
        b.belegnummer ?? "—",
        b.typ === "einnahme" ? "Einnahme" : "Ausgabe",
        b.leistungsbeschreibung,
        formatEuro(b.einzelpreis),
        b.menge,
        formatEuro(b.nettobetrag),
        `${b.mwst_satz} %`,
        formatEuro(b.bruttobetrag),
      ]),
      foot: [
        ["", "", "", "Einnahmen gesamt", "", "", formatEuro(einnahmen), "", ""],
        ["", "", "", "Ausgaben gesamt", "", "", formatEuro(ausgaben), "", ""],
        ["", "", "", "Überschuss (§4 Abs. 3 EStG)", "", "", formatEuro(ueberschuss), "", ""],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fontStyle: "bold", fillColor: [240, 240, 240] },
    })

    doc.save(`EUeR_${MONATE[monat - 1]}_${jahr}.pdf`)
  }

  async function exportJahr(doc: InstanceType<typeof import("jspdf").default>, autoTable: typeof import("jspdf-autotable").default, belege: Beleg[], jahr: number) {
    // Deckblatt-Info
    doc.setFontSize(18)
    doc.text(`EÜR-Jahresübersicht ${jahr}`, 14, 22)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`Einnahmenüberschussrechnung nach §4 Abs. 3 EStG`, 14, 30)
    doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, 14, 35)
    doc.setTextColor(0)

    // Monatsübersicht-Tabelle
    const monateEuer = berechneJahresEuer(belege, jahr)
    const gesamt = monateEuer.reduce(
      (acc, m) => ({ einnahmen: acc.einnahmen + m.einnahmen, ausgaben: acc.ausgaben + m.ausgaben, ueberschuss: acc.ueberschuss + m.ueberschuss }),
      { einnahmen: 0, ausgaben: 0, ueberschuss: 0 }
    )

    doc.setFontSize(11)
    doc.text("Monatsübersicht", 14, 45)

    autoTable(doc, {
      startY: 49,
      head: [["Monat", "Einnahmen", "Ausgaben", "Überschuss"]],
      body: monateEuer
        .filter((m) => m.einnahmen > 0 || m.ausgaben > 0)
        .map((m) => [
          MONATE[m.monat - 1],
          formatEuro(m.einnahmen),
          formatEuro(m.ausgaben),
          formatEuro(m.ueberschuss),
        ]),
      foot: [["Gesamt", formatEuro(gesamt.einnahmen), formatEuro(gesamt.ausgaben), formatEuro(gesamt.ueberschuss)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fontStyle: "bold", fillColor: [240, 240, 240] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    })

    // Neue Seite: alle Einzelbelege
    doc.addPage()
    doc.setFontSize(13)
    doc.text(`Alle Belege ${jahr}`, 14, 20)

    const alleBelegeJahr = belege
      .filter((b) => {
        const [, , j] = b.datum.split(".")
        return parseInt(j) === jahr
      })
      .sort((a, b) => {
        const [tA, mA, jA] = a.datum.split(".")
        const [tB, mB, jB] = b.datum.split(".")
        return new Date(`${jA}-${mA}-${tA}`).getTime() - new Date(`${jB}-${mB}-${tB}`).getTime()
      })

    autoTable(doc, {
      startY: 26,
      head: [["Datum", "Beleg-Nr.", "Typ", "Beschreibung", "Netto", "MwSt", "Brutto"]],
      body: alleBelegeJahr.map((b) => [
        b.datum,
        b.belegnummer ?? "—",
        b.typ === "einnahme" ? "Einnahme" : "Ausgabe",
        b.leistungsbeschreibung,
        formatEuro(b.nettobetrag),
        `${b.mwst_satz} %`,
        formatEuro(b.bruttobetrag),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          data.cell.styles.textColor = data.cell.raw === "Einnahme" ? [22, 163, 74] : [220, 38, 38]
        }
      },
    })

    doc.save(`EUeR_Jahr_${jahr}.pdf`)
  }

  if (modus === "jahr") {
    return (
      <button
        onClick={handleExport}
        className="bg-brand text-white px-6 py-3 rounded-xl hover:bg-brand-deep text-sm font-semibold flex items-center gap-2 shadow-card"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
        </svg>
        Jahres-PDF erstellen
      </button>
    )
  }

  return (
    <button
      onClick={handleExport}
      className="bg-brand text-white px-6 py-3 rounded-xl hover:bg-brand-deep text-sm font-semibold flex items-center gap-2 shadow-card"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
      </svg>
      Monats-PDF erstellen
    </button>
  )
}
