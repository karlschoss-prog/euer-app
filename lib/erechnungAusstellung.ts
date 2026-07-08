// Ausstellung elektronischer Rechnungen aus einer bestehenden Rechnung:
//  · baueCiiXml         → EN-16931-konformes CII-XML (UN/CEFACT, Factur-X-Syntax)
//  · erzeugeXRechnungXml → dieses XML als .xml herunterladen (reine E-Rechnung)
//  · erzeugeZugferdPdf   → Rechnungs-PDF mit eingebettetem CII-XML (ZUGFeRD/Factur-X)
//
// Hinweis: Das erzeugte Hybrid-PDF trägt das XML als "Associated File" (AF) plus
// Factur-X-XMP-Marker und ist mit unserem eigenen Empfang (lib/erechnung.ts) round-
// trip-fähig. Strenge PDF/A-3-Validierung (eingebettete Fonts, ICC-Profil) ist damit
// nicht garantiert — dafür bräuchte es eine dedizierte PDF/A-Toolchain.

import { Rechnung } from "@/types/beleg"
import { rechnungSummen, addTage } from "@/lib/rechnung"

// --- XML-Bausteine ---

function esc(s: string | undefined | null): string {
  if (!s) return ""
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

// "TT.MM.JJJJ" → "JJJJMMTT" (CII-Format 102). Gibt undefined bei Nicht-Datum
// (z. B. Leistungs-Zeitraum als Freitext).
function deDatumZu102(datum: string | undefined): string | undefined {
  if (!datum) return undefined
  const m = datum.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}${m[2]}${m[1]}` : undefined
}

function adresse(strasse?: string, plz?: string, ort?: string, land?: string): string {
  const zeilen: string[] = ["      <ram:PostalTradeAddress>"]
  if (plz) zeilen.push(`        <ram:PostcodeCode>${esc(plz)}</ram:PostcodeCode>`)
  if (strasse) zeilen.push(`        <ram:LineOne>${esc(strasse)}</ram:LineOne>`)
  if (ort) zeilen.push(`        <ram:CityName>${esc(ort)}</ram:CityName>`)
  zeilen.push(`        <ram:CountryID>${esc(land && land.length === 2 ? land : "DE")}</ram:CountryID>`)
  zeilen.push("      </ram:PostalTradeAddress>")
  return zeilen.join("\n")
}

// Baut EN-16931-konformes CII-XML (CrossIndustryInvoice) aus einer Rechnung.
export function baueCiiXml(rechnung: Rechnung): string {
  const a = rechnung.absender
  const e = rechnung.empfaenger
  const summen = rechnungSummen(rechnung.positionen, rechnung.kleinunternehmer)
  const klein = rechnung.kleinunternehmer
  // Steuerkategorie: E = befreit (Kleinunternehmer §19), S = Regelsteuersatz
  const kategorie = klein ? "E" : "S"

  const rechnungsdatum102 = deDatumZu102(rechnung.rechnungsdatum) ?? deDatumZu102(new Date().toLocaleDateString("de-DE"))
  const faellig102 = deDatumZu102(addTage(rechnung.rechnungsdatum, rechnung.zahlungszielTage))
  const leistungsdatum102 = deDatumZu102(rechnung.leistungsdatum)

  // Positionen
  const positionen = rechnung.positionen.map((p, i) => {
    const netto = (p.menge || 0) * (p.einzelpreis || 0)
    const satz = klein ? 0 : p.mwst_satz
    return [
      "    <ram:IncludedSupplyChainTradeLineItem>",
      "      <ram:AssociatedDocumentLineDocument>",
      `        <ram:LineID>${i + 1}</ram:LineID>`,
      "      </ram:AssociatedDocumentLineDocument>",
      "      <ram:SpecifiedTradeProduct>",
      `        <ram:Name>${esc(p.beschreibung)}</ram:Name>`,
      "      </ram:SpecifiedTradeProduct>",
      "      <ram:SpecifiedLineTradeAgreement>",
      "        <ram:NetPriceProductTradePrice>",
      `          <ram:ChargeAmount>${fmt(p.einzelpreis || 0)}</ram:ChargeAmount>`,
      "        </ram:NetPriceProductTradePrice>",
      "      </ram:SpecifiedLineTradeAgreement>",
      "      <ram:SpecifiedLineTradeDelivery>",
      `        <ram:BilledQuantity unitCode="C62">${fmt(p.menge || 0)}</ram:BilledQuantity>`,
      "      </ram:SpecifiedLineTradeDelivery>",
      "      <ram:SpecifiedLineTradeSettlement>",
      "        <ram:ApplicableTradeTax>",
      "          <ram:TypeCode>VAT</ram:TypeCode>",
      `          <ram:CategoryCode>${kategorie}</ram:CategoryCode>`,
      `          <ram:RateApplicablePercent>${fmt(satz)}</ram:RateApplicablePercent>`,
      "        </ram:ApplicableTradeTax>",
      "        <ram:SpecifiedTradeSettlementLineMonetarySummation>",
      `          <ram:LineTotalAmount>${fmt(netto)}</ram:LineTotalAmount>`,
      "        </ram:SpecifiedTradeSettlementLineMonetarySummation>",
      "      </ram:SpecifiedLineTradeSettlement>",
      "    </ram:IncludedSupplyChainTradeLineItem>",
    ].join("\n")
  }).join("\n")

  // Steuer-Untergruppen (BG-23)
  const steuerGruppen = summen.mwstGruppen.map((g) => {
    const zeilen = [
      "      <ram:ApplicableTradeTax>",
      `        <ram:CalculatedAmount>${fmt(g.steuer)}</ram:CalculatedAmount>`,
      "        <ram:TypeCode>VAT</ram:TypeCode>",
    ]
    if (klein) zeilen.push("        <ram:ExemptionReason>Kleinunternehmer gemäß § 19 UStG</ram:ExemptionReason>")
    zeilen.push(
      `        <ram:BasisAmount>${fmt(g.netto)}</ram:BasisAmount>`,
      `        <ram:CategoryCode>${kategorie}</ram:CategoryCode>`,
      `        <ram:RateApplicablePercent>${fmt(klein ? 0 : g.satz)}</ram:RateApplicablePercent>`,
      "      </ram:ApplicableTradeTax>"
    )
    return zeilen.join("\n")
  }).join("\n")

  const sellerSteuerReg: string[] = []
  if (a.ustIdNr) sellerSteuerReg.push(`      <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(a.ustIdNr)}</ram:ID></ram:SpecifiedTaxRegistration>`)
  if (a.steuernummer) sellerSteuerReg.push(`      <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(a.steuernummer)}</ram:ID></ram:SpecifiedTaxRegistration>`)

  const lieferung = leistungsdatum102
    ? [
        "    <ram:ActualDeliverySupplyChainEvent>",
        `      <ram:OccurrenceDateTime><udt:DateTimeString format="102">${leistungsdatum102}</udt:DateTimeString></ram:OccurrenceDateTime>`,
        "    </ram:ActualDeliverySupplyChainEvent>",
      ].join("\n")
    : ""

  const zahlungsziel = faellig102
    ? [
        "      <ram:SpecifiedTradePaymentTerms>",
        `        <ram:DueDateDateTime><udt:DateTimeString format="102">${faellig102}</udt:DateTimeString></ram:DueDateDateTime>`,
        "      </ram:SpecifiedTradePaymentTerms>",
      ].join("\n")
    : ""

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(rechnung.rechnungsnummer)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${rechnungsdatum102}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${positionen}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(a.firmenname)}</ram:Name>
${adresse(a.strasse, a.plz, a.ort, a.land)}
${sellerSteuerReg.join("\n")}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(e.name)}</ram:Name>
${adresse(e.strasse, e.plz, e.ort, e.land)}
${e.ustIdNr ? `        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(e.ustIdNr)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
${lieferung}
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${steuerGruppen}
${zahlungsziel}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt(summen.netto)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt(summen.netto)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmt(summen.steuerGesamt)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt(summen.brutto)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt(summen.brutto)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}

// --- ZUGFeRD/Factur-X: XML ins PDF einbetten ---

function facturXmp(): string {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
   <fx:DocumentType>INVOICE</fx:DocumentType>
   <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
   <fx:Version>1.0</fx:Version>
   <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

// Bettet das CII-XML als Associated File in ein bestehendes PDF ein und setzt den
// Factur-X-XMP-Marker. Gibt die neuen PDF-Bytes zurück.
export async function bettePdfMitXmlEin(pdfBytes: Uint8Array, xml: string): Promise<Uint8Array> {
  const { PDFDocument, AFRelationship, PDFName, PDFRawStream } = await import("pdf-lib")
  const doc = await PDFDocument.load(pdfBytes)

  await doc.attach(new TextEncoder().encode(xml), "factur-x.xml", {
    mimeType: "text/xml",
    description: "Factur-X/ZUGFeRD E-Rechnung (EN 16931)",
    afRelationship: AFRelationship.Alternative,
    creationDate: new Date(),
    modificationDate: new Date(),
  })

  // Factur-X-XMP-Metadaten als /Metadata des Katalogs (best effort)
  try {
    const xmpBytes = new TextEncoder().encode(facturXmp())
    const dict = doc.context.obj({ Type: "Metadata", Subtype: "XML", Length: xmpBytes.length })
    const stream = PDFRawStream.of(dict, xmpBytes)
    const ref = doc.context.register(stream)
    doc.catalog.set(PDFName.of("Metadata"), ref)
  } catch {
    // XMP-Marker optional — Einbettung des XML bleibt gültig
  }

  return await doc.save()
}

// --- Download-Aktionen (Browser) ---

function download(bytes: Uint8Array | string, dateiname: string, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = dateiname
  a.click()
  URL.revokeObjectURL(url)
}

function basisName(rechnung: Rechnung): string {
  return `Rechnung_${rechnung.rechnungsnummer.replace(/[^\w-]/g, "_")}`
}

export function erzeugeXRechnungXml(rechnung: Rechnung): void {
  download(baueCiiXml(rechnung), `${basisName(rechnung)}.xml`, "application/xml")
}

export async function erzeugeZugferdPdf(rechnung: Rechnung): Promise<void> {
  const { erzeugeRechnungPdfBytes } = await import("@/components/RechnungPdf")
  const pdfBytes = await erzeugeRechnungPdfBytes(rechnung)
  const xml = baueCiiXml(rechnung)
  const zugferd = await bettePdfMitXmlEin(pdfBytes, xml)
  download(zugferd, `${basisName(rechnung)}_ZUGFeRD.pdf`, "application/pdf")
}
