// Deterministischer Empfang/Parser für elektronische Rechnungen (E-Rechnung):
//  · XRechnung als reines XML in beiden Syntaxen — UBL (OASIS) und CII (UN/CEFACT)
//  · ZUGFeRD/Factur-X als PDF/A-3 mit eingebettetem CII-XML
// Kein OCR, kein Server: gelesen werden ausschließlich die strukturierten XML-Daten
// nach EN 16931. Die Feldbezeichner in Kommentaren tragen die BT-/BG-Nummern der Norm.

export interface ERechnungMwstGruppe {
  satz: number      // Prozent, z. B. 19
  netto: number     // Bemessungsgrundlage
  steuer: number    // Steuerbetrag
}

export interface ERechnungDaten {
  syntax: "ubl" | "cii"
  ausPdf: boolean               // true, wenn aus einem ZUGFeRD-PDF extrahiert
  rechnungsnummer?: string      // BT-1
  rechnungsdatum?: string       // BT-2, als TT.MM.JJJJ
  leistungsdatum?: string       // BT-72, als TT.MM.JJJJ
  verkaeufer?: string           // BT-27 (Seller Name)
  kaeufer?: string              // BT-44 (Buyer Name)
  waehrung?: string             // BT-5
  mwstGruppen: ERechnungMwstGruppe[]  // BG-23
  nettoGesamt: number           // BT-109
  steuerGesamt: number          // BT-110
  bruttoGesamt: number          // BT-112
}

// --- DOM-Navigation (namespace-/präfix-unabhängig über localName) ---

function elementKinder(el: Element): Element[] {
  const out: Element[] = []
  const cn = el.childNodes
  for (let i = 0; i < cn.length; i++) {
    const n = cn[i]
    if (n.nodeType === 1) out.push(n as Element)
  }
  return out
}

function ersterNach(el: Element | undefined, localName: string): Element | undefined {
  if (!el) return undefined
  return elementKinder(el).find((c) => c.localName === localName)
}

// Folgt einem Pfad von direkten Kindelementen (nach localName).
function pfad(start: Element | undefined, ...names: string[]): Element | undefined {
  let cur = start
  for (const n of names) {
    cur = ersterNach(cur, n)
    if (!cur) return undefined
  }
  return cur
}

// Erster Nachfahre (beliebig tief) mit passendem localName.
function tiefErster(el: Element | undefined, localName: string): Element | undefined {
  if (!el) return undefined
  for (const kind of elementKinder(el)) {
    if (kind.localName === localName) return kind
    const treffer = tiefErster(kind, localName)
    if (treffer) return treffer
  }
  return undefined
}

function txt(el: Element | undefined): string | undefined {
  const t = el?.textContent?.trim()
  return t ? t : undefined
}

function zahl(el: Element | undefined): number {
  const t = txt(el)
  if (!t) return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

// Datum → TT.MM.JJJJ. Akzeptiert "JJJJ-MM-TT" (UBL) und "JJJJMMTT" (CII, Format 102).
function normDatum(roh: string | undefined): string | undefined {
  if (!roh) return undefined
  const s = roh.trim()
  let y: string, m: string, d: string
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    ;[y, m, d] = [s.slice(0, 4), s.slice(5, 7), s.slice(8, 10)]
  } else if (/^\d{8}$/.test(s)) {
    ;[y, m, d] = [s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)]
  } else {
    return undefined
  }
  return `${d}.${m}.${y}`
}

// --- UBL (OASIS Invoice-2 / CreditNote-2) ---

function parseUbl(root: Element): ERechnungDaten {
  const rechnungsnummer = txt(ersterNach(root, "ID"))
  const rechnungsdatum = normDatum(txt(ersterNach(root, "IssueDate")))
  const waehrung = txt(ersterNach(root, "DocumentCurrencyCode"))

  const lieferant = pfad(root, "AccountingSupplierParty", "Party")
  const verkaeufer =
    txt(pfad(lieferant, "PartyLegalEntity", "RegistrationName")) ??
    txt(pfad(lieferant, "PartyName", "Name"))

  const kunde = pfad(root, "AccountingCustomerParty", "Party")
  const kaeufer =
    txt(pfad(kunde, "PartyLegalEntity", "RegistrationName")) ??
    txt(pfad(kunde, "PartyName", "Name"))

  const leistungsdatum =
    normDatum(txt(pfad(root, "Delivery", "ActualDeliveryDate"))) ??
    normDatum(txt(pfad(root, "InvoicePeriod", "EndDate")))

  // BG-23: Steueraufschlüsselung aus TaxTotal/TaxSubtotal
  const mwstGruppen: ERechnungMwstGruppe[] = []
  const taxTotal = ersterNach(root, "TaxTotal")
  if (taxTotal) {
    for (const sub of elementKinder(taxTotal).filter((c) => c.localName === "TaxSubtotal")) {
      const netto = zahl(ersterNach(sub, "TaxableAmount"))
      const steuer = zahl(ersterNach(sub, "TaxAmount"))
      const satz = zahl(pfad(sub, "TaxCategory", "Percent"))
      mwstGruppen.push({ satz, netto, steuer })
    }
  }

  const summe = ersterNach(root, "LegalMonetaryTotal")
  const nettoGesamt = zahl(ersterNach(summe, "TaxExclusiveAmount"))
  const bruttoGesamt = zahl(ersterNach(summe, "TaxInclusiveAmount"))
  const steuerGesamt = zahl(ersterNach(taxTotal, "TaxAmount")) ||
    mwstGruppen.reduce((s, g) => s + g.steuer, 0)

  return {
    syntax: "ubl", ausPdf: false,
    rechnungsnummer, rechnungsdatum, leistungsdatum,
    verkaeufer, kaeufer, waehrung,
    mwstGruppen: fasseGruppen(mwstGruppen),
    nettoGesamt: nettoGesamt || mwstGruppen.reduce((s, g) => s + g.netto, 0),
    steuerGesamt,
    bruttoGesamt: bruttoGesamt || nettoGesamt + steuerGesamt,
  }
}

// --- CII (UN/CEFACT CrossIndustryInvoice) ---

function parseCii(root: Element, ausPdf: boolean): ERechnungDaten {
  const dokument = ersterNach(root, "ExchangedDocument")
  const rechnungsnummer = txt(ersterNach(dokument, "ID"))
  const rechnungsdatum = normDatum(txt(tiefErster(ersterNach(dokument, "IssueDateTime"), "DateTimeString")))

  const transaktion = ersterNach(root, "SupplyChainTradeTransaction")
  const vereinbarung = ersterNach(transaktion, "ApplicableHeaderTradeAgreement")
  const verkaeufer = txt(pfad(vereinbarung, "SellerTradeParty", "Name"))
  const kaeufer = txt(pfad(vereinbarung, "BuyerTradeParty", "Name"))

  const lieferung = ersterNach(transaktion, "ApplicableHeaderTradeDelivery")
  const leistungsdatum = normDatum(
    txt(tiefErster(pfad(lieferung, "ActualDeliverySupplyChainEvent", "OccurrenceDateTime"), "DateTimeString"))
  )

  const abrechnung = ersterNach(transaktion, "ApplicableHeaderTradeSettlement")
  const waehrung = txt(ersterNach(abrechnung, "InvoiceCurrencyCode"))

  // BG-23: je ApplicableTradeTax eine Gruppe
  const mwstGruppen: ERechnungMwstGruppe[] = []
  if (abrechnung) {
    for (const tax of elementKinder(abrechnung).filter((c) => c.localName === "ApplicableTradeTax")) {
      const netto = zahl(ersterNach(tax, "BasisAmount"))
      const steuer = zahl(ersterNach(tax, "CalculatedAmount"))
      const satz = zahl(ersterNach(tax, "RateApplicablePercent"))
      mwstGruppen.push({ satz, netto, steuer })
    }
  }

  const summe = ersterNach(abrechnung, "SpecifiedTradeSettlementHeaderMonetarySummation")
  const nettoGesamt = zahl(ersterNach(summe, "TaxBasisTotalAmount"))
  const steuerGesamt = zahl(ersterNach(summe, "TaxTotalAmount")) ||
    mwstGruppen.reduce((s, g) => s + g.steuer, 0)
  const bruttoGesamt = zahl(ersterNach(summe, "GrandTotalAmount"))

  return {
    syntax: "cii", ausPdf,
    rechnungsnummer, rechnungsdatum, leistungsdatum,
    verkaeufer, kaeufer, waehrung,
    mwstGruppen: fasseGruppen(mwstGruppen),
    nettoGesamt: nettoGesamt || mwstGruppen.reduce((s, g) => s + g.netto, 0),
    steuerGesamt,
    bruttoGesamt: bruttoGesamt || nettoGesamt + steuerGesamt,
  }
}

// Fasst Gruppen gleichen Steuersatzes zusammen (auf 2 Nachkommastellen gerundet).
function fasseGruppen(gruppen: ERechnungMwstGruppe[]): ERechnungMwstGruppe[] {
  const map = new Map<number, ERechnungMwstGruppe>()
  for (const g of gruppen) {
    const satz = Math.round(g.satz * 100) / 100
    const vorhanden = map.get(satz) ?? { satz, netto: 0, steuer: 0 }
    vorhanden.netto += g.netto
    vorhanden.steuer += g.steuer
    map.set(satz, vorhanden)
  }
  return [...map.values()].sort((a, b) => a.satz - b.satz)
}

// --- Öffentliche Einstiegspunkte ---

export function parseXmlRechnung(xmlText: string, ausPdf = false): ERechnungDaten | null {
  try {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml")
    if (doc.getElementsByTagName("parsererror").length > 0) return null
    const root = doc.documentElement
    if (!root) return null
    if (root.localName === "CrossIndustryInvoice") return parseCii(root, ausPdf)
    if (root.localName === "Invoice" || root.localName === "CreditNote") return parseUbl(root)
    return null
  } catch {
    return null
  }
}

// Erkennt anhand von Dateiendung/MIME und Inhalt, wie zu parsen ist.
export async function parseERechnungDatei(file: File): Promise<ERechnungDaten | null> {
  const name = file.name.toLowerCase()
  const istXml = file.type.includes("xml") || name.endsWith(".xml")
  const istPdf = file.type === "application/pdf" || name.endsWith(".pdf")

  if (istXml) {
    return parseXmlRechnung(await file.text())
  }
  if (istPdf) {
    const xml = await extrahiereXmlAusPdf(new Uint8Array(await file.arrayBuffer()))
    return xml ? parseXmlRechnung(xml, true) : null
  }
  return null
}

// --- ZUGFeRD: eingebettetes XML aus dem PDF holen ---

// Sucht in den Stream-Objekten eines PDF nach dem eingebetteten Rechnungs-XML.
// ZUGFeRD/Factur-X legt das CII-XML als (meist FlateDecode-komprimierten) Stream
// ab. Wir dekomprimieren jeden Stream und prüfen auf Rechnungs-Marker — das kommt
// ohne vollständigen PDF-Parser aus und ist robust gegen abweichende Dateinamen.
export async function extrahiereXmlAusPdf(bytes: Uint8Array): Promise<string | null> {
  const streams = findeStreamBloecke(bytes)
  for (const roh of streams) {
    for (const kandidat of await entpackeKandidaten(roh)) {
      if (istRechnungsXml(kandidat)) return kandidat
    }
  }
  return null
}

function istRechnungsXml(text: string): boolean {
  if (!text.includes("<?xml") && !text.includes("<rsm:") && !text.includes("<Invoice")) return false
  return (
    text.includes("CrossIndustryInvoice") ||
    /<([A-Za-z]+:)?Invoice[ >]/.test(text) ||
    /<([A-Za-z]+:)?CreditNote[ >]/.test(text)
  )
}

// Rohbytes aller stream…endstream-Blöcke.
function findeStreamBloecke(bytes: Uint8Array): Uint8Array[] {
  const ausgabe: Uint8Array[] = []
  const streamTok = str2bytes("stream")
  const endTok = str2bytes("endstream")
  let i = 0
  while (i < bytes.length) {
    const s = indexOf(bytes, streamTok, i)
    if (s < 0) break
    // Nach "stream" folgt CRLF, LF oder CR
    let daten = s + streamTok.length
    if (bytes[daten] === 0x0d) daten++
    if (bytes[daten] === 0x0a) daten++
    const e = indexOf(bytes, endTok, daten)
    if (e < 0) break
    let ende = e
    // optional voranstehende EOL vor endstream abschneiden
    if (bytes[ende - 1] === 0x0a) ende--
    if (bytes[ende - 1] === 0x0d) ende--
    ausgabe.push(bytes.slice(daten, ende))
    i = e + endTok.length
  }
  return ausgabe
}

// Liefert mögliche Klartext-Varianten eines Streams: roh (unkomprimiert) sowie
// zlib- und raw-deflate-dekomprimiert.
async function entpackeKandidaten(roh: Uint8Array): Promise<string[]> {
  const out: string[] = []
  const alsText = () => new TextDecoder("utf-8", { fatal: false }).decode(roh)
  // 1) evtl. unkomprimiert
  out.push(alsText())
  // 2) FlateDecode (zlib) / raw deflate
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const entpackt = await inflate(roh, format)
      out.push(new TextDecoder("utf-8", { fatal: false }).decode(entpackt))
    } catch {
      // dieser Stream ist nicht in diesem Format komprimiert — überspringen
    }
  }
  return out
}

async function inflate(data: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format)
  const stream = new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds))
  return new Uint8Array(await stream.arrayBuffer())
}

// --- Byte-Hilfen ---

function str2bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function indexOf(hay: Uint8Array, needle: Uint8Array, von: number): number {
  outer: for (let i = von; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}
