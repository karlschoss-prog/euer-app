"use client"

import { Rechnung, RechnungDesign } from "@/types/beleg"
import { formatEuro } from "@/lib/formatierung"
import { rechnungSummen, addTage, RechnungSummen } from "@/lib/rechnung"

type RGB = [number, number, number]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPdfDoc = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AutoTable = any

interface RechnungPdfProps {
  rechnung: Rechnung
  className?: string
  label?: string
}

function bildFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")
    ? "JPEG"
    : "PNG"
}

function hexZuRgb(hex: string): RGB {
  const h = hex.replace("#", "")
  const voll = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const num = parseInt(voll, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

// Mischt eine Farbe Richtung Weiß (amt: 0 = Originalfarbe, 1 = weiß)
function aufhellen([r, g, b]: RGB, amt: number): RGB {
  return [
    Math.round(r + (255 - r) * amt),
    Math.round(g + (255 - g) * amt),
    Math.round(b + (255 - b) * amt),
  ]
}

const STANDARD_FARBEN: Record<RechnungDesign, RGB> = {
  klassisch: [59, 130, 246],
  kreativ: [236, 72, 153],
  elegant: [38, 38, 38],
  "ks-rec": [210, 58, 47],
}

export function akzentFarbe(rechnung: Rechnung): RGB {
  const a = rechnung.absender
  if (a.akzentfarbe) return hexZuRgb(a.akzentfarbe)
  return STANDARD_FARBEN[a.design ?? "klassisch"]
}

// --- Gemeinsame Bausteine ---

function positionsTabelle(rechnung: Rechnung) {
  const zeigeSteuer = !rechnung.kleinunternehmer
  const head = zeigeSteuer
    ? [["Pos.", "Beschreibung", "Menge", "Einzelpreis", "MwSt", "Gesamt"]]
    : [["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Gesamt"]]
  const body = rechnung.positionen.map((p, i) => {
    const netto = (p.menge || 0) * (p.einzelpreis || 0)
    const beschreibung = p.leistungsdatum
      ? `${p.beschreibung}\nLeistungsdatum: ${p.leistungsdatum}`
      : p.beschreibung
    const basis = [String(i + 1), beschreibung, String(p.menge).replace(".", ","), formatEuro(p.einzelpreis)]
    return zeigeSteuer ? [...basis, `${p.mwst_satz} %`, formatEuro(netto)] : [...basis, formatEuro(netto)]
  })
  const rechtsBuendig = zeigeSteuer
    ? { 0: { cellWidth: 12 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } }
    : { 0: { cellWidth: 12 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } }
  return { head, body, columnStyles: rechtsBuendig }
}

export function empfaengerZeilen(rechnung: Rechnung): string[] {
  const e = rechnung.empfaenger
  return [e.name, e.ansprechpartner, e.strasse, [e.plz, e.ort].filter(Boolean).join(" "), e.land]
    .filter(Boolean) as string[]
}

function metaZeilen(rechnung: Rechnung): [string, string][] {
  const e = rechnung.empfaenger
  // Steuer-Nr. & USt-IdNr. des Absenders stehen nur noch in der Fußzeile
  // (gängige Platzierung auf deutschen Rechnungen), nicht mehr hier oben.
  return ([
    ["Rechnungs-Nr.", rechnung.rechnungsnummer],
    ["Rechnungsdatum", rechnung.rechnungsdatum],
    ["Leistungsdatum", rechnung.leistungsdatum],
    ["Kunden-USt-IdNr.", e.ustIdNr],
  ].filter(([, v]) => !!v) as [string, string][])
}

function pflichtFusszeile(rechnung: Rechnung): string {
  const a = rechnung.absender
  // Firmenname + Kontakt-/Steuerangaben. Inhaber und Anschrift bewusst weg (stehen im Kopf).
  const fuss: string[] = []
  if (a.firmenname) fuss.push(a.firmenname)
  if (a.telefon) fuss.push(`Tel: ${a.telefon}`)
  if (a.email) fuss.push(a.email)
  if (a.website) fuss.push(a.website)
  if (a.steuernummer) fuss.push(`Steuer-Nr.: ${a.steuernummer}`)
  if (a.ustIdNr) fuss.push(`USt-IdNr.: ${a.ustIdNr}`)
  return fuss.join(" · ")
}

export function zeichneFusszeile(doc: JsPdfDoc, rechnung: Rechnung) {
  doc.setFontSize(7)
  doc.setTextColor(140)
  const zeilen = doc.splitTextToSize(pflichtFusszeile(rechnung), 170)
  doc.text(zeilen, 105, 286, { align: "center" })
  doc.setTextColor(0)
}

// Setzt das Logo seitenverhältnistreu in den Kasten (x..x+maxW, y..y+maxH).
// Es wird so weit wie möglich skaliert, rechtsbündig und vertikal zentriert
// im Kasten platziert — kein Stauchen mehr.
export function logoEinfuegen(doc: JsPdfDoc, logo: string | undefined, x: number, y: number, maxW: number, maxH: number) {
  if (!logo) return
  try {
    const props = doc.getImageProperties(logo)
    const ratio = props.width / props.height
    let w = maxW
    let h = w / ratio
    if (h > maxH) { h = maxH; w = h * ratio }
    const px = x + (maxW - w)        // rechtsbündig (rechte Kante bleibt am Rand)
    const py = y + (maxH - h) / 2    // vertikal zentriert
    doc.addImage(logo, bildFormat(logo), px, py, w, h, undefined, "FAST")
  } catch {
    // ungültiges Bild ignorieren
  }
}

// =================== Design: KLASSISCH ===================

function renderKlassisch(doc: JsPdfDoc, autoTable: AutoTable, rechnung: Rechnung, summen: RechnungSummen, accent: RGB) {
  const a = rechnung.absender
  const links = 20, rechts = 190

  logoEinfuegen(doc, a.logo, rechts - 40, 15, 40, 20)

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text([a.firmenname, a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).join(" · "), links, 45)
  doc.setTextColor(0)

  doc.setFontSize(10)
  let y = 52
  empfaengerZeilen(rechnung).forEach((z) => { doc.text(z, links, y); y += 5 })

  doc.setFontSize(9)
  let yMeta = 52
  metaZeilen(rechnung).forEach(([k, v]) => {
    doc.setTextColor(120); doc.text(k, 130, yMeta)
    doc.setTextColor(0); doc.text(v, rechts, yMeta, { align: "right" })
    yMeta += 5
  })

  y = Math.max(y, yMeta) + 8
  doc.setFontSize(14); doc.setFont("helvetica", "bold")
  doc.text(rechnung.betreff || `Rechnung ${rechnung.rechnungsnummer}`, links, y)
  doc.setFont("helvetica", "normal"); y += 8

  if (rechnung.einleitungstext) {
    doc.setFontSize(10)
    const zeilen = doc.splitTextToSize(rechnung.einleitungstext, rechts - links)
    doc.text(zeilen, links, y); y += zeilen.length * 5 + 2
  }

  const { head, body, columnStyles } = positionsTabelle(rechnung)
  autoTable(doc, {
    startY: y, head, body,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: 255 },
    columnStyles,
  })

  zeichneSummenRechts(doc, rechnung, summen, accent, "linie")
  zeichneAbschluss(doc, rechnung, accent)
  zeichneFusszeile(doc, rechnung)
}

// =================== Design: KREATIV ===================

function renderKreativ(doc: JsPdfDoc, autoTable: AutoTable, rechnung: Rechnung, summen: RechnungSummen, accent: RGB) {
  const a = rechnung.absender
  const links = 20, rechts = 190
  const hell = aufhellen(accent, 0.9)

  // Farbband oben
  doc.setFillColor(...accent)
  doc.rect(0, 0, 210, 44, "F")
  logoEinfuegen(doc, a.logo, rechts - 42, 11, 42, 22)

  doc.setTextColor(255)
  doc.setFont("helvetica", "bold"); doc.setFontSize(30)
  doc.text("RECHNUNG", links, 26)
  doc.setFont("helvetica", "normal"); doc.setFontSize(11)
  doc.text(a.firmenname, links, 35)
  doc.setTextColor(0)

  // Empfänger
  let y = 60
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...accent)
  doc.text("RECHNUNG AN", links, y)
  doc.setFont("helvetica", "normal"); doc.setTextColor(60); doc.setFontSize(10)
  y += 6
  empfaengerZeilen(rechnung).forEach((z) => { doc.text(z, links, y); y += 5 })

  // Meta rechts
  let yMeta = 60
  doc.setFontSize(9)
  metaZeilen(rechnung).forEach(([k, v]) => {
    doc.setFont("helvetica", "bold"); doc.setTextColor(...accent); doc.text(k, 130, yMeta)
    doc.setFont("helvetica", "normal"); doc.setTextColor(60); doc.text(v, rechts, yMeta, { align: "right" })
    yMeta += 5
  })
  doc.setTextColor(0)

  y = Math.max(y, yMeta) + 8
  doc.setFontSize(15); doc.setFont("helvetica", "bold"); doc.setTextColor(...accent)
  doc.text(rechnung.betreff || `Rechnung ${rechnung.rechnungsnummer}`, links, y)
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 8

  if (rechnung.einleitungstext) {
    doc.setFontSize(10)
    const zeilen = doc.splitTextToSize(rechnung.einleitungstext, rechts - links)
    doc.text(zeilen, links, y); y += zeilen.length * 5 + 2
  }

  const { head, body, columnStyles } = positionsTabelle(rechnung)
  autoTable(doc, {
    startY: y, head, body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: accent, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: hell },
    columnStyles,
  })

  // Summen: farbiger Block
  let ySum = doc.lastAutoTable.finalY + 8
  if (rechnung.kleinunternehmer) {
    doc.setFillColor(...accent); doc.roundedRect(120, ySum, 70, 14, 2, 2, "F")
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(11)
    doc.text("Gesamt", 124, ySum + 9)
    doc.text(formatEuro(summen.netto), 186, ySum + 9, { align: "right" })
    doc.setTextColor(0); ySum += 20
  } else {
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(60)
    doc.text("Zwischensumme (netto)", 120, ySum); doc.text(formatEuro(summen.netto), 186, ySum, { align: "right" })
    ySum += 6
    summen.mwstGruppen.forEach((g) => {
      doc.text(`zzgl. ${g.satz} % MwSt`, 120, ySum); doc.text(formatEuro(g.steuer), 186, ySum, { align: "right" })
      ySum += 6
    })
    doc.setTextColor(0)
    doc.setFillColor(...accent); doc.roundedRect(120, ySum, 70, 14, 2, 2, "F")
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(12)
    doc.text("Rechnungsbetrag", 124, ySum + 9)
    doc.text(formatEuro(summen.brutto), 186, ySum + 9, { align: "right" })
    doc.setTextColor(0); ySum += 20
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(9)
  ySum = zeichneHinweisUndBank(doc, rechnung, ySum)

  // Dank-Note in Akzentfarbe
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...accent)
  doc.text("Vielen Dank für die Zusammenarbeit!", links, ySum + 4)
  doc.setTextColor(0); doc.setFont("helvetica", "normal")

  if (rechnung.fusstext) {
    doc.setFontSize(8); doc.setTextColor(120)
    doc.text(doc.splitTextToSize(rechnung.fusstext, rechts - links), links, ySum + 12)
    doc.setTextColor(0)
  }

  zeichneFusszeile(doc, rechnung)
}

// =================== Design: ELEGANT ===================

function renderElegant(doc: JsPdfDoc, autoTable: AutoTable, rechnung: Rechnung, summen: RechnungSummen, accent: RGB) {
  const a = rechnung.absender
  const links = 20, rechts = 190
  doc.setFont("times", "normal")

  logoEinfuegen(doc, a.logo, rechts - 38, 16, 38, 19)

  doc.setFontSize(9); doc.setTextColor(130)
  doc.text("R E C H N U N G", links, 22)
  doc.setFontSize(22); doc.setTextColor(30)
  doc.text(a.firmenname, links, 33)
  doc.setTextColor(0)

  doc.setDrawColor(200); doc.setLineWidth(0.3)
  doc.line(links, 40, rechts, 40)

  doc.setFontSize(10)
  let y = 52
  empfaengerZeilen(rechnung).forEach((z) => { doc.text(z, links, y); y += 5 })

  doc.setFontSize(9)
  let yMeta = 52
  metaZeilen(rechnung).forEach(([k, v]) => {
    doc.setTextColor(130); doc.text(k, 130, yMeta)
    doc.setTextColor(40); doc.text(v, rechts, yMeta, { align: "right" })
    yMeta += 5
  })
  doc.setTextColor(0)

  y = Math.max(y, yMeta) + 10
  doc.setFontSize(13)
  doc.text(rechnung.betreff || `Rechnung ${rechnung.rechnungsnummer}`, links, y)
  y += 7

  if (rechnung.einleitungstext) {
    doc.setFontSize(10)
    const zeilen = doc.splitTextToSize(rechnung.einleitungstext, rechts - links)
    doc.text(zeilen, links, y); y += zeilen.length * 5 + 2
  }

  const { head, body, columnStyles } = positionsTabelle(rechnung)
  autoTable(doc, {
    startY: y, head, body,
    theme: "plain",
    styles: { font: "times", fontSize: 10, cellPadding: 2.5 },
    headStyles: { textColor: accent, fontStyle: "bold", lineWidth: { bottom: 0.4 }, lineColor: accent },
    bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: [220, 220, 220] },
    columnStyles,
  })

  zeichneSummenRechts(doc, rechnung, summen, accent, "elegant")
  zeichneAbschluss(doc, rechnung, accent)
  zeichneFusszeile(doc, rechnung)
}

// --- gemeinsame Summen-/Abschlussblöcke (klassisch & elegant) ---

function zeichneSummenRechts(doc: JsPdfDoc, rechnung: Rechnung, summen: RechnungSummen, accent: RGB, stil: "linie" | "elegant") {
  let ySum = doc.lastAutoTable.finalY + 8
  const labelX = 120, wertX = 190
  doc.setFontSize(10)

  function zeile(label: string, wert: string, fett = false) {
    doc.setFont(stil === "elegant" ? "times" : "helvetica", fett ? "bold" : "normal")
    doc.text(label, labelX, ySum); doc.text(wert, wertX, ySum, { align: "right" })
    ySum += 6
  }

  if (rechnung.kleinunternehmer) {
    zeile("Gesamtbetrag", formatEuro(summen.netto), true)
  } else {
    zeile("Zwischensumme (netto)", formatEuro(summen.netto))
    summen.mwstGruppen.forEach((g) => zeile(`zzgl. ${g.satz} % MwSt`, formatEuro(g.steuer)))
    doc.setDrawColor(...accent); doc.setLineWidth(0.4); doc.line(labelX, ySum - 3, wertX, ySum - 3)
    zeile("Rechnungsbetrag", formatEuro(summen.brutto), true)
  }
  doc.setLineWidth(0.2)
  doc.lastSummenY = ySum + 4
}

// Zeichnet den Bankverbindungs-Block (Trennlinie, Überschrift, Kontoinhaber/IBAN/BIC/Bank)
// als beschriftete Label/Wert-Liste. Wird von Rechnung und Mahnung geteilt (DRY).
// Gibt das neue y zurück; zeichnet nichts, wenn keine Bankdaten hinterlegt sind.
export function zeichneBankverbindung(doc: JsPdfDoc, font: string, rechnung: Rechnung, startY: number): number {
  const a = rechnung.absender
  const links = 20, rechts = 190
  const bank = ([
    ["Kontoinhaber", a.kontoinhaber],
    ["IBAN", a.iban],
    ["BIC", a.bic],
    ["Bank", a.bank],
  ].filter(([, v]) => !!v) as [string, string][])
  if (!bank.length) return startY

  let y = startY + 4
  doc.setDrawColor(220); doc.setLineWidth(0.3); doc.line(links, y, rechts, y)
  y += 8
  doc.setFont(font, "bold"); doc.setFontSize(10); doc.setTextColor(40)
  doc.text("Bankverbindung", links, y)
  doc.setFont(font, "normal"); doc.setFontSize(9)
  y += 8
  bank.forEach(([k, v]) => {
    doc.setTextColor(140); doc.text(k, links, y)
    doc.setTextColor(40); doc.text(v, links + 38, y)
    y += 6
  })
  doc.setTextColor(0)
  return y
}

function zeichneHinweisUndBank(doc: JsPdfDoc, rechnung: Rechnung, startY: number): number {
  const links = 20
  const font = rechnung.absender.design === "elegant" ? "times" : "helvetica"
  let y = startY

  doc.setFont(font, "normal")
  doc.setFontSize(9)
  doc.setTextColor(0)
  if (rechnung.kleinunternehmer) {
    const zeilen = doc.splitTextToSize("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).", 170)
    doc.text(zeilen, links, y); y += zeilen.length * 5 + 2
  }

  y = zeichneBankverbindung(doc, font, rechnung, y)

  // Zahlungsziel + Verwendungszweck-Hinweis
  y += 4
  doc.setFontSize(9); doc.setTextColor(140)
  doc.text(`Zahlungsziel: ${rechnung.zahlungszielTage} Tage nach Rechnungserhalt`, links, y)
  y += 5.5
  doc.text("Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.", links, y)
  y += 6
  doc.setTextColor(0)
  return y
}

function zeichneAbschluss(doc: JsPdfDoc, rechnung: Rechnung, accent: RGB) {
  void accent
  const y = zeichneHinweisUndBank(doc, rechnung, doc.lastSummenY ?? doc.lastAutoTable.finalY + 16)
  if (rechnung.fusstext) {
    doc.setFontSize(8); doc.setTextColor(120)
    doc.text(doc.splitTextToSize(rechnung.fusstext, 170), 20, y + 2)
    doc.setTextColor(0)
  }
}

// =================== Dispatcher ===================

// Rendert eine Rechnung auf die AKTUELLE Seite des Dokuments (jsPDF-Designs).
// erzwingeKlassisch: für die Mahnungs-Beilage, wenn das Originaldesign react-pdf
// ("ks-rec") ist und nicht in ein jsPDF-Dokument gemischt werden kann.
function rendereAufAktuelleSeite(doc: JsPdfDoc, autoTable: AutoTable, rechnung: Rechnung, erzwingeKlassisch = false) {
  const summen = rechnungSummen(rechnung.positionen, rechnung.kleinunternehmer)
  const accent = akzentFarbe(rechnung)
  const design = erzwingeKlassisch ? "klassisch" : (rechnung.absender.design ?? "klassisch")

  if (design === "kreativ") renderKreativ(doc, autoTable, rechnung, summen, accent)
  else if (design === "elegant") renderElegant(doc, autoTable, rechnung, summen, accent)
  else renderKlassisch(doc, autoTable, rechnung, summen, accent)
}

async function baueRechnungDoc(rechnung: Rechnung): Promise<JsPdfDoc> {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  rendereAufAktuelleSeite(doc, autoTable, rechnung)
  return doc
}

// Hängt die Original-Rechnung als neue Seite an ein bestehendes jsPDF-Dokument an
// (z. B. um sie einer Mahnung beizulegen — "Rechnung muss mitgesendet werden").
// Das react-pdf-Design "ks-rec" lässt sich nicht in ein jsPDF-Dokument mischen;
// für die Beilage wird dann das klassische Layout verwendet, damit eine einzige
// Datei entsteht.
export async function haengeRechnungAnDoc(doc: JsPdfDoc, rechnung: Rechnung): Promise<void> {
  const { default: autoTable } = await import("jspdf-autotable")
  doc.addPage()
  const istReactPdfDesign = rechnung.absender.design === "ks-rec"
  rendereAufAktuelleSeite(doc, autoTable, rechnung, istReactPdfDesign)
}

// --- react-pdf-Designs (z. B. "KS · REC") ---
// Diese Designs sind echte React-Komponenten und werden über @react-pdf/renderer
// erzeugt, nicht über jsPDF. Schwere Abhängigkeit daher dynamisch laden.

function dueDateBerechnen(rechnung: Rechnung): string {
  return addTage(rechnung.rechnungsdatum, rechnung.zahlungszielTage)
}

async function reactPdfBlob(rechnung: Rechnung): Promise<Blob> {
  const a = rechnung.absender
  const e = rechnung.empfaenger
  const [{ pdf }, { default: InvoicePDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/invoice-designs/InvoicePDF"),
  ])

  const data = {
    invoiceNo: rechnung.rechnungsnummer,
    invoiceDate: rechnung.rechnungsdatum,
    servicePeriod: rechnung.leistungsdatum || "—",
    dueDate: dueDateBerechnen(rechnung),
    sender: {
      name: a.firmenname,
      street: a.strasse ?? "",
      city: [a.plz, a.ort].filter(Boolean).join(" "),
      email: a.email ?? "",
      taxNo: a.steuernummer || a.ustIdNr || "",
    },
    client: {
      company: e.name,
      contact: e.ansprechpartner,
      street: e.strasse ?? "",
      city: [e.plz, e.ort].filter(Boolean).join(" "),
    },
    items: rechnung.positionen.map((p) => ({
      name: p.beschreibung,
      detail: p.leistungsdatum ? `Leistungsdatum: ${p.leistungsdatum}` : undefined,
      qty: p.menge,
      unit: p.einzelpreis,
    })),
    bank: {
      name: a.bank || a.kontoinhaber || "",
      iban: a.iban ?? "",
      bic: a.bic ?? "",
    },
    paymentDays: rechnung.zahlungszielTage,
  }

  return pdf(<InvoicePDF data={data} />).toBlob()
}

function istReactPdfDesign(rechnung: Rechnung): boolean {
  return rechnung.absender.design === "ks-rec"
}

export async function erzeugeRechnungPdf(rechnung: Rechnung): Promise<void> {
  const dateiname = `Rechnung_${rechnung.rechnungsnummer.replace(/[^\w-]/g, "_")}.pdf`
  if (istReactPdfDesign(rechnung)) {
    const blob = await reactPdfBlob(rechnung)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = dateiname
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  const doc = await baueRechnungDoc(rechnung)
  doc.save(dateiname)
}

// Liefert die rohen PDF-Bytes einer Rechnung (für Weiterverarbeitung, z. B.
// XML-Einbettung zu ZUGFeRD/Factur-X). Deckt beide Render-Wege ab.
export async function erzeugeRechnungPdfBytes(rechnung: Rechnung): Promise<Uint8Array> {
  if (istReactPdfDesign(rechnung)) {
    const blob = await reactPdfBlob(rechnung)
    return new Uint8Array(await blob.arrayBuffer())
  }
  const doc = await baueRechnungDoc(rechnung)
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer)
}

// Blob-URL für die Vorschau (Aufrufer gibt sie mit URL.revokeObjectURL frei).
export async function erzeugeRechnungVorschauUrl(rechnung: Rechnung): Promise<string> {
  if (istReactPdfDesign(rechnung)) {
    const blob = await reactPdfBlob(rechnung)
    return URL.createObjectURL(blob)
  }
  const doc = await baueRechnungDoc(rechnung)
  return doc.output("bloburl") as unknown as string
}

export default function RechnungPdf({ rechnung, className, label = "PDF herunterladen" }: RechnungPdfProps) {
  return (
    <button
      onClick={() => erzeugeRechnungPdf(rechnung)}
      className={
        className ??
        "bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-deep text-sm font-semibold flex items-center gap-2 shadow-card"
      }
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
      </svg>
      {label}
    </button>
  )
}
