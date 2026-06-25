# CLAUDE.md — EÜR-App Projektgedächtnis

## Projektkontext

Dies ist ein Proof of Concept für eine schlanke Web-App zur Einnahmenüberschussrechnung (EÜR)
für Einzelunternehmer in Deutschland. Das Produkt ist als SaaS geplant und soll später
selbst gehostet werden.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- LocalStorage für Datenpersistenz (PoC-Phase)
- PDF-Generierung via react-pdf oder jsPDF (clientseitig)

## Projektstruktur

```
euer-app/
├── CLAUDE.md
├── briefing-euer-app.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Dashboard / EÜR-Übersicht
│   ├── einnahmen/
│   │   └── page.tsx              # Einnahmen erfassen und anzeigen
│   ├── ausgaben/
│   │   └── page.tsx              # Ausgaben erfassen und anzeigen
│   └── export/
│       └── page.tsx              # PDF-Export Monatsübersicht
├── components/
│   ├── BelegForm.tsx             # Wiederverwendbares Formular (Einnahme & Ausgabe)
│   ├── BelegTabelle.tsx          # Tabellenansicht mit Datumsortierung
│   ├── EuerUebersicht.tsx        # EÜR-Berechnung monatlich + kumuliert
│   └── PdfExport.tsx             # PDF-Generierung Monatsübersicht
├── lib/
│   ├── storage.ts                # LocalStorage Lese- und Schreiblogik
│   ├── berechnung.ts             # EÜR-Berechnungslogik
│   └── formatierung.ts           # Deutsches Datums- und Zahlenformat
└── types/
    └── beleg.ts                  # TypeScript-Typen für Einnahmen und Ausgaben
```

## Datenmodell

```typescript
// types/beleg.ts
type BelegTyp = "einnahme" | "ausgabe"

interface Beleg {
  id: string                  // UUID
  typ: BelegTyp
  datum: string               // Format: TT.MM.JJJJ
  belegnummer: string
  kunde_lieferant: string     // Kundenname (Einnahme) oder Lieferant (Ausgabe)
  leistungsbeschreibung: string
  menge: number
  einzelpreis: number         // Netto, in EUR
  gesamtpreis: number         // Netto, berechnet
  mwst_satz: number           // z.B. 19 oder 7
  nettobetrag: number         // = gesamtpreis
  kategorie?: string          // optional
  erstellt_am: string         // ISO-Timestamp
}
```

## Deutsches Format — immer einhalten

- Datum: TT.MM.JJJJ (Eingabe und Ausgabe)
- Zahlen: Komma als Dezimaltrenner, Punkt als Tausendertrenner (1.234,56 €)
- Währung: EUR, immer mit €-Zeichen
- Sprache: durchgehend Deutsch, auch Feldbezeichnungen und Fehlermeldungen

## Formatierungsfunktionen (lib/formatierung.ts)

```typescript
// Zahl zu deutschem Format
export function formatEuro(betrag: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(betrag)
}

// Datum von ISO zu TT.MM.JJJJ
export function formatDatum(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}.${month}.${year}`
}
```

## EÜR-Logik (lib/berechnung.ts)

```typescript
// Monatliche EÜR
export function berechneMonatsEuer(belege: Beleg[], monat: number, jahr: number) {
  const gefiltert = belege.filter(b => {
    const [tag, mon, j] = b.datum.split(".")
    return parseInt(mon) === monat && parseInt(j) === jahr
  })
  const einnahmen = gefiltert.filter(b => b.typ === "einnahme").reduce((s, b) => s + b.nettobetrag, 0)
  const ausgaben = gefiltert.filter(b => b.typ === "ausgabe").reduce((s, b) => s + b.nettobetrag, 0)
  return { einnahmen, ausgaben, ueberschuss: einnahmen - ausgaben }
}

// Kumulierte Jahresansicht
export function berechneJahresEuer(belege: Beleg[], jahr: number) {
  return Array.from({ length: 12 }, (_, i) => ({
    monat: i + 1,
    ...berechneMonatsEuer(belege, i + 1, jahr),
  }))
}
```

## LocalStorage-Schema (lib/storage.ts)

```typescript
const STORAGE_KEY = "euer_belege"

export function ladeBelege(): Beleg[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : []
}

export function speichereBeleg(beleg: Beleg): void {
  const belege = ladeBelege()
  belege.push(beleg)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(belege))
}

export function loescheBeleg(id: string): void {
  const belege = ladeBelege().filter(b => b.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(belege))
}
```

## PDF-Export

- Bibliothek: jsPDF + jspdf-autotable
- Inhalt: Monatsübersicht als Tabelle (Datum, Belegnummer, Beschreibung, Netto, MwSt, Gesamt)
- Kopfzeile: "Monatsübersicht [Monat] [Jahr]"
- Summenzeile am Ende: Einnahmen gesamt, Ausgaben gesamt, Überschuss
- Format: A4, Hochformat, druckfertig

## Pflichtfelder im Formular

- Datum (TT.MM.JJJJ)
- Belegnummer
- Kunde / Lieferant
- Leistungsbeschreibung
- Menge
- Einzelpreis (Netto)
- MwSt-Satz (0%, 7%, 19%)

Gesamtpreis und Nettobetrag werden automatisch berechnet und angezeigt.

## Optionale Felder

- Kategorie / Kostenart

## Wichtige Hinweise für Claude Code

- Keine Benutzeranmeldung im PoC
- Keine externe Datenbank im PoC — alles über LocalStorage
- Kein Cloud-Zwang
- Scope eng halten — kein Feature außerhalb dieses Briefings ohne Rückfrage
- Berechnungen immer mit Nettobeträgen (EÜR nach §4 Abs. 3 EStG)
- MwSt wird erfasst aber nicht für die EÜR-Berechnung genutzt (nur Dokumentation)
- Komponenten wiederverwendbar halten (BelegForm für Einnahmen und Ausgaben)

## Nächste Ausbaustufen (noch nicht bauen)

- Login + Datenbank (SQLite oder PostgreSQL, selbst gehostet)
- E-Rechnungsformat XRechnung / ZUGFeRD (ab 2027 Pflicht)
- Mehrbenutzer und Mandantenfähigkeit (SaaS-Ausbau)
- Steuerberaterschnittstelle / DATEV-Export
