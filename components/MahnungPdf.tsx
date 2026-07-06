"use client"

import { Rechnung, Mahnung } from "@/types/beleg"
import { formatEuro } from "@/lib/formatierung"
import { mahnStufeConfig } from "@/lib/mahnung"
import {
  akzentFarbe,
  empfaengerZeilen,
  logoEinfuegen,
  zeichneBankverbindung,
  zeichneFusszeile,
  haengeRechnungAnDoc,
} from "@/components/RechnungPdf"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPdfDoc = any

interface MahnTexte {
  absaetze: string[]
  frist: string
  schluss: string
}

// Textbausteine je Eskalationsstufe. Ton eskaliert von freundlicher Erinnerung
// bis zur Ankündigung des gerichtlichen Mahnverfahrens.
function mahnTexte(mahnung: Mahnung, rechnung: Rechnung): MahnTexte {
  const nr = rechnung.rechnungsnummer
  const frist = mahnung.neuesZahlungsziel
  // bezug ohne Possessivpronomen, damit "unsere" / "unserer" je nach Kasus passt.
  const bezug = `Rechnung Nr. ${nr} vom ${rechnung.rechnungsdatum}`

  switch (mahnung.stufe) {
    case "zahlungserinnerung":
      return {
        absaetze: [
          `sicher ist es Ihrer Aufmerksamkeit entgangen: Auf unsere ${bezug} konnten wir bislang keinen Zahlungseingang feststellen.`,
          `Falls sich Ihre Zahlung mit diesem Schreiben überschneidet, betrachten Sie es bitte als gegenstandslos.`,
        ],
        frist: `Wir möchten Sie freundlich bitten, den offenen Betrag bis zum ${frist} auszugleichen.`,
        schluss: `Vielen Dank für Ihre Erledigung.`,
      }
    case "mahnung_1":
      return {
        absaetze: [
          `trotz unserer ${bezug} und der bereits abgelaufenen Zahlungsfrist konnten wir bis heute keinen Zahlungseingang feststellen.`,
          `Für den entstandenen Mehraufwand berechnen wir Ihnen Mahnkosten. Die offene Forderung setzt sich wie folgt zusammen:`,
        ],
        frist: `Bitte überweisen Sie die Gesamtforderung bis spätestens ${frist} unter Angabe der Rechnungsnummer ${nr}.`,
        schluss: `Sollten Sie den Betrag zwischenzeitlich überwiesen haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.`,
      }
    case "mahnung_2":
      return {
        absaetze: [
          `auch nach unserer ersten Mahnung ist der offene Betrag zu unserer ${bezug} bislang nicht bei uns eingegangen.`,
          `Mit dieser 2. Mahnung fordern wir Sie letztmalig außergerichtlich zur Zahlung des folgenden Betrags auf:`,
        ],
        frist: `Bitte begleichen Sie die Gesamtforderung bis spätestens ${frist}.`,
        schluss: `Sollte die Zahlung erneut ausbleiben, sehen wir uns gezwungen, das gerichtliche Mahnverfahren einzuleiten — verbunden mit weiteren Kosten zu Ihren Lasten.`,
      }
    case "mahnverfahren":
    default:
      return {
        absaetze: [
          `trotz mehrfacher Mahnung haben Sie die offene Forderung zu unserer ${bezug} bis heute nicht beglichen.`,
          `Wir sehen uns daher gezwungen, das gerichtliche Mahnverfahren beim zuständigen Amtsgericht einzuleiten und einen Mahnbescheid gegen Sie zu beantragen. Die hierdurch entstehenden Kosten (Gerichtskosten, Verzugszinsen und Kosten der Rechtsverfolgung) gehen zu Ihren Lasten.`,
        ],
        frist: `Um das gerichtliche Verfahren zu vermeiden, zahlen Sie die Gesamtforderung bitte bis spätestens ${frist}.`,
        schluss: `Nach fruchtlosem Ablauf dieser Frist reichen wir den Antrag auf Erlass eines Mahnbescheids ohne weitere Ankündigung ein.`,
      }
  }
}

function zeichneMahnschreiben(doc: JsPdfDoc, mahnung: Mahnung, rechnung: Rechnung) {
  const a = rechnung.absender
  const accent = akzentFarbe(rechnung)
  const cfg = mahnStufeConfig(mahnung.stufe)
  const links = 20, rechts = 190

  logoEinfuegen(doc, a.logo, rechts - 40, 15, 40, 20)

  // Absenderzeile (klein, grau) über dem Empfängerfeld
  doc.setFontSize(7); doc.setTextColor(120)
  doc.text(
    [a.firmenname, a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
    links, 45
  )
  doc.setTextColor(0)

  // Empfänger
  doc.setFontSize(10)
  let y = 55
  empfaengerZeilen(rechnung).forEach((z) => { doc.text(z, links, y); y += 5 })

  // Meta rechts
  doc.setFontSize(9)
  let yMeta = 55
  const meta: [string, string][] = [
    ["Datum", mahnung.mahndatum],
    ["Rechnungs-Nr.", rechnung.rechnungsnummer],
    ["Rechnungsdatum", rechnung.rechnungsdatum],
  ]
  meta.forEach(([k, v]) => {
    doc.setTextColor(120); doc.text(k, 130, yMeta)
    doc.setTextColor(0); doc.text(v, rechts, yMeta, { align: "right" })
    yMeta += 5
  })

  y = Math.max(y, yMeta) + 12

  // Betreff
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(accent[0], accent[1], accent[2])
  doc.text(`${cfg.label} – Rechnung ${rechnung.rechnungsnummer}`, links, y)
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 10

  const texte = mahnTexte(mahnung, rechnung)

  // Anrede
  doc.setFontSize(10)
  doc.text("Sehr geehrte Damen und Herren,", links, y); y += 7

  // Einleitungsabsätze
  texte.absaetze.forEach((p) => {
    const zeilen = doc.splitTextToSize(p, rechts - links)
    doc.text(zeilen, links, y); y += zeilen.length * 5 + 3
  })

  // Forderungsaufstellung (rechtsbündig)
  y += 2
  const labelX = 120, wertX = 190
  const summenZeile = (label: string, wert: string, fett = false) => {
    doc.setFont("helvetica", fett ? "bold" : "normal")
    doc.text(label, labelX, y); doc.text(wert, wertX, y, { align: "right" })
    y += 6
  }
  summenZeile("Offener Rechnungsbetrag", formatEuro(mahnung.rechnungsbetrag))
  if (mahnung.mahnkostenBetrag > 0) {
    summenZeile(`Mahnkosten (${mahnung.mahnkostenProzent} %)`, formatEuro(mahnung.mahnkostenBetrag))
  }
  doc.setDrawColor(accent[0], accent[1], accent[2]); doc.setLineWidth(0.4)
  doc.line(labelX, y - 3, wertX, y - 3)
  summenZeile("Gesamtforderung", formatEuro(mahnung.gesamtforderung), true)
  doc.setLineWidth(0.2)
  doc.setFont("helvetica", "normal") // Fettschrift der Summenzeile zurücksetzen
  y += 4

  // Fristsatz + Schlusssatz
  ;[texte.frist, texte.schluss].forEach((p) => {
    const zeilen = doc.splitTextToSize(p, rechts - links)
    doc.text(zeilen, links, y); y += zeilen.length * 5 + 3
  })

  // Grußformel
  y += 3
  doc.text("Mit freundlichen Grüßen", links, y); y += 6
  const signatur = [a.firmenname, a.inhaber].filter(Boolean).join(", ")
  if (signatur) { doc.text(signatur, links, y); y += 6 }

  // Bankverbindung (geteilter Baustein mit der Rechnung)
  zeichneBankverbindung(doc, "helvetica", rechnung, y + 2)

  // Pflichtfußzeile
  zeichneFusszeile(doc, rechnung)
}

async function baueMahnungDoc(mahnung: Mahnung, rechnung: Rechnung): Promise<JsPdfDoc> {
  const { default: jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  zeichneMahnschreiben(doc, mahnung, rechnung)
  // Original-Rechnung als Folgeseite(n) anhängen ("Rechnung muss mitgesendet werden")
  await haengeRechnungAnDoc(doc, rechnung)
  return doc
}

function dateiname(mahnung: Mahnung, rechnung: Rechnung): string {
  const stufe = mahnStufeConfig(mahnung.stufe).label.replace(/[^\w]+/g, "_")
  const nr = rechnung.rechnungsnummer.replace(/[^\w-]/g, "_")
  return `${stufe}_${nr}.pdf`
}

export async function erzeugeMahnungPdf(mahnung: Mahnung, rechnung: Rechnung): Promise<void> {
  const doc = await baueMahnungDoc(mahnung, rechnung)
  doc.save(dateiname(mahnung, rechnung))
}

// Blob-URL für die Vorschau (Aufrufer gibt sie mit URL.revokeObjectURL frei).
export async function erzeugeMahnungVorschauUrl(mahnung: Mahnung, rechnung: Rechnung): Promise<string> {
  const doc = await baueMahnungDoc(mahnung, rechnung)
  return doc.output("bloburl") as unknown as string
}
