import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"

/**
 * KS — UGC Invoice (react-pdf)
 * ---------------------------------------------------------------
 * Druckfertige A4-Rechnung im Stil der Marke "KS · REC".
 * Helvetica ist in react-pdf eingebaut — keine Font-Registrierung nötig.
 * Übernommen aus dem Design-Handoff (Japandi/Wabi-Sabi, ein roter Akzent).
 */

export interface InvoiceData {
  invoiceNo: string
  invoiceDate: string
  servicePeriod?: string
  dueDate: string
  sender: { name: string; street: string; city: string; email: string; taxNo: string }
  client: { company: string; contact?: string; street: string; city: string }
  items: { name: string; detail?: string; qty: number; unit: number }[]
  bank: { name: string; iban: string; bic: string }
  paymentDays?: number
}

const C = {
  ink: "#1C1B19",
  paper: "#F5F3EE",
  red: "#D23A2F",
  muted: "#6B6760",
  soft: "#8C887F",
  faint: "#A8A299",
  body: "#3C3A36",
  hair: "#E0DBD1",
  hair2: "#E6E1D8",
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    color: C.ink,
    fontFamily: "Helvetica",
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 53,
    fontSize: 9.75,
  },
  // brand viewfinder corners on the sheet
  corner: { position: "absolute", width: 22, height: 22 },
  cTL: { top: 26, left: 26, borderTopWidth: 1.1, borderLeftWidth: 1.1, borderColor: C.ink },
  cTR: { top: 26, right: 26, borderTopWidth: 1.1, borderRightWidth: 1.1, borderColor: C.ink },
  cBL: { bottom: 26, left: 26, borderBottomWidth: 1.1, borderLeftWidth: 1.1, borderColor: C.ink },
  cBR: { bottom: 26, right: 26, borderBottomWidth: 1.1, borderRightWidth: 1.1, borderColor: C.ink },

  // header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoBox: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: "relative",
  },
  logoCorner: { position: "absolute", width: 10, height: 10 },
  ks: { fontFamily: "Helvetica-Bold", fontSize: 26, letterSpacing: -1.3 },
  recRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  dot: { width: 4.5, height: 4.5, borderRadius: 4.5, backgroundColor: C.red, marginRight: 4 },
  recTxt: { fontSize: 6.8, letterSpacing: 2.3, color: C.red },

  titleWrap: { alignItems: "flex-end" },
  titleRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 33, letterSpacing: 0.3 },
  titleDot: { width: 6.5, height: 6.5, borderRadius: 6.5, backgroundColor: C.red, marginLeft: 4, marginTop: 4 },
  invNo: { fontSize: 9, color: C.muted, marginTop: 10 },

  // meta strip (centered)
  meta: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 34,
    paddingBottom: 19,
    borderBottomWidth: 1,
    borderBottomColor: C.hair,
  },
  metaCell: { alignItems: "center", marginHorizontal: 24 },
  label: { fontSize: 6.8, letterSpacing: 1.6, color: C.faint, marginBottom: 5, textTransform: "uppercase" },
  metaVal: { fontSize: 9.75 },

  // parties
  parties: { flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  party: { width: "47%" },
  partyLabel: { fontSize: 6.8, letterSpacing: 1.6, color: C.faint, marginBottom: 7, textTransform: "uppercase" },
  strong: { fontFamily: "Helvetica-Bold" },
  line: { lineHeight: 1.7, fontSize: 9.75 },
  lineMuted: { color: C.muted },

  // items table
  table: { marginTop: 38 },
  thead: {
    flexDirection: "row",
    paddingBottom: 9,
    borderBottomWidth: 1.1,
    borderBottomColor: C.ink,
  },
  th: { fontSize: 6.8, letterSpacing: 1.6, color: C.faint, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.hair2,
  },
  colDesc: { flex: 1, paddingRight: 12 },
  colQty: { width: 52, textAlign: "center" },
  colUnit: { width: 82, textAlign: "right" },
  colSum: { width: 90, textAlign: "right" },
  itemName: { fontFamily: "Helvetica-Bold", fontSize: 9.75 },
  itemDesc: { color: C.soft, fontSize: 8.6, marginTop: 3 },

  // totals
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 19 },
  totals: { width: 248 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalMuted: { fontSize: 9.75, color: C.muted },
  taxMuted: { fontSize: 9, color: C.soft },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 9,
    paddingTop: 12,
    borderTopWidth: 1.1,
    borderTopColor: C.ink,
  },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 9.75, letterSpacing: 0.2 },
  grandVal: { fontFamily: "Helvetica-Bold", fontSize: 18 },

  // §19 note
  note: { flexDirection: "row", alignItems: "flex-start", marginTop: 25 },
  noteDot: { width: 4.5, height: 4.5, borderRadius: 4.5, backgroundColor: C.red, marginTop: 3.5, marginRight: 7 },
  noteTxt: { fontSize: 8.6, color: C.muted, lineHeight: 1.6, flex: 1 },

  // spacer pushes payment block to bottom
  spacer: { flexGrow: 1, minHeight: 30 },

  // payment + bank
  payment: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 19,
    borderTopWidth: 1,
    borderTopColor: C.hair,
  },
  payCol: { width: "47%" },
  payTxt: { fontSize: 9, color: C.body, lineHeight: 1.7 },

  footer: { marginTop: 25 },
  thanks: { fontFamily: "Helvetica-Bold", fontSize: 9.75, letterSpacing: 0.2 },
})

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"

export default function InvoicePDF({ data }: { data: InvoiceData }) {
  const {
    invoiceNo,
    invoiceDate,
    servicePeriod,
    dueDate,
    sender,
    client,
    items,
    bank,
    paymentDays = 14,
  } = data

  const subtotal = items.reduce((s, it) => s + it.qty * it.unit, 0)

  return (
    <Document title={`Rechnung ${invoiceNo}`} author={sender.name}>
      <Page size="A4" style={styles.page}>
        {/* viewfinder corners */}
        <View style={[styles.corner, styles.cTL]} fixed />
        <View style={[styles.corner, styles.cTR]} fixed />
        <View style={[styles.corner, styles.cBL]} fixed />
        <View style={[styles.corner, styles.cBR]} fixed />

        {/* header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <View style={[styles.logoCorner, { top: 0, left: 0, borderTopWidth: 1.1, borderLeftWidth: 1.1, borderColor: C.ink }]} />
            <View style={[styles.logoCorner, { top: 0, right: 0, borderTopWidth: 1.1, borderRightWidth: 1.1, borderColor: C.ink }]} />
            <View style={[styles.logoCorner, { bottom: 0, left: 0, borderBottomWidth: 1.1, borderLeftWidth: 1.1, borderColor: C.ink }]} />
            <View style={[styles.logoCorner, { bottom: 0, right: 0, borderBottomWidth: 1.1, borderRightWidth: 1.1, borderColor: C.ink }]} />
            <Text style={styles.ks}>KS</Text>
            <View style={styles.recRow}>
              <View style={styles.dot} />
              <Text style={styles.recTxt}>REC</Text>
            </View>
          </View>

          <View style={styles.titleWrap}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>RECHNUNG</Text>
              <View style={styles.titleDot} />
            </View>
            <Text style={styles.invNo}>Nr. {invoiceNo}</Text>
          </View>
        </View>

        {/* meta strip */}
        <View style={styles.meta}>
          <View style={styles.metaCell}>
            <Text style={styles.label}>Rechnungsdatum</Text>
            <Text style={styles.metaVal}>{invoiceDate}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>Leistungszeitraum</Text>
            <Text style={styles.metaVal}>{servicePeriod}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>Fällig bis</Text>
            <Text style={styles.metaVal}>{dueDate}</Text>
          </View>
        </View>

        {/* parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Von</Text>
            <Text style={[styles.line, styles.strong]}>{sender.name}</Text>
            <Text style={styles.line}>{sender.street}</Text>
            <Text style={styles.line}>{sender.city}</Text>
            <Text style={styles.line}>{sender.email}</Text>
            <Text style={[styles.line, styles.lineMuted]}>Steuernummer: {sender.taxNo}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>An</Text>
            <Text style={[styles.line, styles.strong]}>{client.company}</Text>
            {client.contact ? <Text style={styles.line}>z. Hd. {client.contact}</Text> : null}
            <Text style={styles.line}>{client.street}</Text>
            <Text style={styles.line}>{client.city}</Text>
          </View>
        </View>

        {/* items */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colDesc]}>Beschreibung</Text>
            <Text style={[styles.th, styles.colQty]}>Menge</Text>
            <Text style={[styles.th, styles.colUnit]}>Einzelpreis</Text>
            <Text style={[styles.th, styles.colSum]}>Betrag</Text>
          </View>
          {items.map((it, i) => (
            <View style={styles.row} key={i} wrap={false}>
              <View style={styles.colDesc}>
                <Text style={styles.itemName}>{it.name}</Text>
                {it.detail ? <Text style={styles.itemDesc}>{it.detail}</Text> : null}
              </View>
              <Text style={[styles.metaVal, styles.colQty]}>{it.qty}</Text>
              <Text style={[styles.metaVal, styles.colUnit]}>{fmt(it.unit)}</Text>
              <Text style={[styles.metaVal, styles.colSum]}>{fmt(it.qty * it.unit)}</Text>
            </View>
          ))}
        </View>

        {/* totals */}
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalMuted}>Zwischensumme</Text>
              <Text style={styles.totalMuted}>{fmt(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.taxMuted}>Umsatzsteuer (§19 UStG)</Text>
              <Text style={styles.taxMuted}>{fmt(0)}</Text>
            </View>
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Gesamtbetrag</Text>
              <Text style={styles.grandVal}>{fmt(subtotal)}</Text>
            </View>
          </View>
        </View>

        {/* §19 note */}
        <View style={styles.note}>
          <View style={styles.noteDot} />
          <Text style={styles.noteTxt}>
            Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).
          </Text>
        </View>

        {/* spacer */}
        <View style={styles.spacer} />

        {/* payment + bank */}
        <View style={styles.payment} wrap={false}>
          <View style={styles.payCol}>
            <Text style={styles.partyLabel}>Zahlung</Text>
            <Text style={styles.payTxt}>
              Zahlung innerhalb von <Text style={styles.strong}>{paymentDays} Tagen</Text>.
            </Text>
          </View>
          <View style={styles.payCol}>
            <Text style={styles.partyLabel}>Bankverbindung</Text>
            <Text style={styles.payTxt}>{bank.name}</Text>
            <Text style={styles.payTxt}>IBAN: {bank.iban}</Text>
            <Text style={styles.payTxt}>BIC: {bank.bic}</Text>
          </View>
        </View>

        {/* footer */}
        <View style={styles.footer}>
          <Text style={styles.thanks}>Danke für die Zusammenarbeit.</Text>
        </View>
      </Page>
    </Document>
  )
}
