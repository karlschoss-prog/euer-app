"use client"

import { Suspense, useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { v4 as uuidv4 } from "uuid"
import {
  Unternehmensprofil, Kunde, Rechnung, AbsenderSnapshot, EmpfaengerSnapshot,
} from "@/types/beleg"
import {
  ladeProfile, ladeKunden, ladeStandardProfil, ladeRechnung,
  speichereRechnungMitBelegen,
} from "@/lib/storage"
import { rechnungSummen, formatRechnungsnummer, addTage } from "@/lib/rechnung"
import { formatEuro } from "@/lib/formatierung"
import Toast from "@/components/Toast"
import { erzeugeRechnungPdf } from "@/components/RechnungPdf"
import RechnungVorschauModal from "@/components/RechnungVorschauModal"

interface PositionEntwurf {
  beschreibung: string
  mengeText: string
  einzelpreisText: string
  mwst_satz: number
  leistungsdatum: string
}

function parseZahl(wert: string): number {
  return parseFloat(wert.replace(/\./g, "").replace(",", ".")) || 0
}

function isoZuDeutsch(iso: string): string {
  if (!iso || !iso.includes("-")) return iso
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

function deutschZuISO(de: string): string {
  if (!de || !de.includes(".")) return ""
  const [d, m, y] = de.split(".")
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

// Zerlegt einen Leistungszeitraum ("TT.MM.JJJJ – TT.MM.JJJJ" oder einzelnes Datum)
// in ISO-Von/Bis für die Kalenderfelder. Freitext (z. B. "Juni 2026") ergibt leer.
function parseZeitraum(text: string): [string, string] {
  const istDatum = (s: string) => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s.trim())
  const zuIso = (s: string) => (istDatum(s) ? deutschZuISO(s.trim()) : "")
  const teile = (text ?? "").split(/\s*[–-]\s*/)
  if (teile.length >= 2) return [zuIso(teile[0]), zuIso(teile[1])]
  return [zuIso(teile[0] ?? ""), ""]
}

function leerePosition(mwst: number): PositionEntwurf {
  return { beschreibung: "", mengeText: "1", einzelpreisText: "", mwst_satz: mwst, leistungsdatum: "" }
}

function absenderAus(p: Unternehmensprofil): AbsenderSnapshot {
  return {
    firmenname: p.firmenname, inhaber: p.inhaber, strasse: p.strasse, plz: p.plz, ort: p.ort,
    land: p.land, email: p.email, telefon: p.telefon, website: p.website,
    steuernummer: p.steuernummer, ustIdNr: p.ustIdNr, iban: p.iban, bic: p.bic, bank: p.bank,
    kontoinhaber: p.kontoinhaber, logo: p.logo, design: p.design, akzentfarbe: p.akzentfarbe,
    kleinunternehmer: p.kleinunternehmer,
  }
}

function RechnungNeuContent() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get("id")

  const [profile, setProfile] = useState<Unternehmensprofil[]>([])
  const [kunden, setKunden] = useState<Kunde[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [geladen, setGeladen] = useState(false)
  const [vorschau, setVorschau] = useState<Rechnung | null>(null)

  // Formularfelder
  const [profilId, setProfilId] = useState("")
  const [kundeId, setKundeId] = useState("")
  const [empfaenger, setEmpfaenger] = useState<EmpfaengerSnapshot>({ name: "" })
  const [rechnungsnummer, setRechnungsnummer] = useState("")
  const [rechnungsdatumIso, setRechnungsdatumIso] = useState(new Date().toISOString().split("T")[0])
  const [leistungsdatum, setLeistungsdatum] = useState("")
  const [leistungVonIso, setLeistungVonIso] = useState("")
  const [leistungBisIso, setLeistungBisIso] = useState("")
  const [betreff, setBetreff] = useState("")
  const [einleitungstext, setEinleitungstext] = useState("")
  const [fusstext, setFusstext] = useState("")
  const [zahlungszielTage, setZahlungszielTage] = useState(14)
  const [kleinunternehmer, setKleinunternehmer] = useState(false)
  const [positionen, setPositionen] = useState<PositionEntwurf[]>([leerePosition(19)])
  const [status, setStatus] = useState<"offen" | "bezahlt">("offen")
  const [zahlungsdatumIso, setZahlungsdatumIso] = useState("")
  const [erstelltAm, setErstelltAm] = useState(new Date().toISOString())

  const aktuellesProfil = profile.find((p) => p.id === profilId)

  // Initial laden
  useEffect(() => {
    const ps = ladeProfile()
    const ks = ladeKunden()
    setProfile(ps)
    setKunden(ks)

    if (editId) {
      const r = ladeRechnung(editId)
      if (r) {
        setProfilId(r.profilId)
        setKundeId(r.kundeId ?? "")
        setEmpfaenger(r.empfaenger)
        setRechnungsnummer(r.rechnungsnummer)
        setRechnungsdatumIso(deutschZuISO(r.rechnungsdatum) || new Date().toISOString().split("T")[0])
        setLeistungsdatum(r.leistungsdatum ?? "")
        {
          const [lv, lb] = parseZeitraum(r.leistungsdatum ?? "")
          setLeistungVonIso(lv)
          setLeistungBisIso(lb)
        }
        setBetreff(r.betreff ?? "")
        setEinleitungstext(r.einleitungstext ?? "")
        setFusstext(r.fusstext ?? "")
        setZahlungszielTage(r.zahlungszielTage)
        setKleinunternehmer(r.kleinunternehmer)
        setStatus(r.status)
        setZahlungsdatumIso(deutschZuISO(r.zahlungsdatum ?? ""))
        setErstelltAm(r.erstellt_am)
        setPositionen(
          r.positionen.map((p) => ({
            beschreibung: p.beschreibung,
            mengeText: String(p.menge).replace(".", ","),
            einzelpreisText: p.einzelpreis.toFixed(2).replace(".", ","),
            mwst_satz: p.mwst_satz,
            leistungsdatum: p.leistungsdatum ?? "",
          }))
        )
      }
    } else {
      const std = ladeStandardProfil()
      if (std) anwendenProfil(std)
    }
    setGeladen(true)
  }, [editId])

  // Profil-Defaults übernehmen (nur bei neuer Rechnung / Profilwechsel)
  function anwendenProfil(p: Unternehmensprofil) {
    setProfilId(p.id)
    setRechnungsnummer(formatRechnungsnummer(p))
    setZahlungszielTage(p.zahlungszielTage)
    setKleinunternehmer(p.kleinunternehmer)
    setEinleitungstext(p.einleitungstext ?? "")
    setFusstext(p.fusstext ?? "")
    setPositionen((alt) => alt.map((pos) => ({ ...pos, mwst_satz: p.kleinunternehmer ? 0 : pos.mwst_satz })))
  }

  function handleProfilWechsel(id: string) {
    const p = profile.find((x) => x.id === id)
    if (p) anwendenProfil(p)
  }

  function handleKundeWechsel(id: string) {
    setKundeId(id)
    const k = kunden.find((x) => x.id === id)
    if (k) {
      setEmpfaenger({
        name: k.name, ansprechpartner: k.ansprechpartner, strasse: k.strasse,
        plz: k.plz, ort: k.ort, land: k.land, ustIdNr: k.ustIdNr,
      })
    }
  }

  function setEmpf<K extends keyof EmpfaengerSnapshot>(key: K, wert: EmpfaengerSnapshot[K]) {
    setEmpfaenger((e) => ({ ...e, [key]: wert }))
  }

  function setPos(i: number, patch: Partial<PositionEntwurf>) {
    setPositionen((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  const positionenFinal = useMemo(
    () =>
      positionen.map((p) => ({
        beschreibung: p.beschreibung.trim(),
        menge: parseZahl(p.mengeText),
        einzelpreis: parseZahl(p.einzelpreisText),
        mwst_satz: kleinunternehmer ? 0 : p.mwst_satz,
        leistungsdatum: p.leistungsdatum.trim() || undefined,
      })),
    [positionen, kleinunternehmer]
  )

  const summen = useMemo(
    () => rechnungSummen(positionenFinal, kleinunternehmer),
    [positionenFinal, kleinunternehmer]
  )

  function baueRechnung(): Rechnung | null {
    if (!aktuellesProfil) { setToast("Bitte ein Unternehmensprofil wählen"); return null }
    if (!empfaenger.name.trim()) { setToast("Bitte einen Empfänger angeben"); return null }
    if (!rechnungsnummer.trim()) { setToast("Bitte eine Rechnungsnummer angeben"); return null }
    if (positionenFinal.every((p) => !p.beschreibung || p.einzelpreis === 0)) {
      setToast("Bitte mindestens eine Position erfassen"); return null
    }
    // Bei "bezahlt" ist das Zahlungsdatum der Zuflusstag; Default = heute
    const zahlungsdatum =
      status === "bezahlt"
        ? isoZuDeutsch(zahlungsdatumIso || new Date().toISOString().split("T")[0])
        : undefined
    return {
      id: editId ?? uuidv4(),
      rechnungsnummer: rechnungsnummer.trim(),
      profilId,
      absender: absenderAus(aktuellesProfil),
      kundeId: kundeId || undefined,
      empfaenger,
      rechnungsdatum: isoZuDeutsch(rechnungsdatumIso),
      zahlungsdatum,
      leistungsdatum: leistungsdatum.trim() || undefined,
      positionen: positionenFinal.filter((p) => p.beschreibung || p.einzelpreis !== 0),
      zahlungszielTage,
      betreff: betreff.trim() || undefined,
      einleitungstext: einleitungstext.trim() || undefined,
      fusstext: fusstext.trim() || undefined,
      kleinunternehmer,
      status,
      erstellt_am: erstelltAm,
    }
  }

  function speichern() {
    const r = baueRechnung()
    if (!r) return
    speichereRechnungMitBelegen(r)
    router.push("/rechnungen")
  }

  async function speichernUndPdf() {
    const r = baueRechnung()
    if (!r) return
    speichereRechnungMitBelegen(r)
    await erzeugeRechnungPdf(r)
    router.push("/rechnungen")
  }

  function vorschauOeffnen() {
    const r = baueRechnung()
    if (r) setVorschau(r)
  }

  if (geladen && profile.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-surface border-2 border-dashed border-line rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">🏢</div>
          <h2 className="text-lg font-semibold mb-2">Zuerst ein Unternehmensprofil anlegen</h2>
          <p className="text-muted text-sm mb-6">Eine Rechnung braucht einen Absender mit Steuernummer und Adresse.</p>
          <Link href="/unternehmen" className="bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-deep text-sm font-medium">
            Profil anlegen
          </Link>
        </div>
      </div>
    )
  }

  const faellig = addTage(isoZuDeutsch(rechnungsdatumIso), zahlungszielTage)

  // Setzt Von/Bis aus dem Kalender und schreibt den Zeitraum als Text ins Leistungsdatum.
  function aktualisiereZeitraum(vonIso: string, bisIso: string) {
    setLeistungVonIso(vonIso)
    setLeistungBisIso(bisIso)
    const von = vonIso ? isoZuDeutsch(vonIso) : ""
    const bis = bisIso ? isoZuDeutsch(bisIso) : ""
    if (von && bis) setLeistungsdatum(von === bis ? von : `${von} – ${bis}`)
    else if (von) setLeistungsdatum(von)
    else if (bis) setLeistungsdatum(bis)
    else setLeistungsdatum("")
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{editId ? "Rechnung bearbeiten" : "Neue Rechnung"}</h1>
        <Link href="/rechnungen" className="text-sm text-muted hover:underline">← Zurück</Link>
      </div>

      {/* Profil + Kunde */}
      <section className="bg-surface border rounded-xl p-6 shadow-sm grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Unternehmen (Absender)</label>
          <select value={profilId} onChange={(e) => handleProfilWechsel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {profile.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Kunde</label>
          <select value={kundeId} onChange={(e) => handleKundeWechsel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— manuell eingeben —</option>
            {kunden.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </div>
      </section>

      {/* Empfänger */}
      <section className="bg-surface border rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold">Rechnungsempfänger</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted mb-1">Name / Firma *</label>
            <input value={empfaenger.name} onChange={(e) => setEmpf("name", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Ansprechpartner</label>
            <input value={empfaenger.ansprechpartner ?? ""} onChange={(e) => setEmpf("ansprechpartner", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">USt-IdNr.</label>
            <input value={empfaenger.ustIdNr ?? ""} onChange={(e) => setEmpf("ustIdNr", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted mb-1">Straße & Nr.</label>
            <input value={empfaenger.strasse ?? ""} onChange={(e) => setEmpf("strasse", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">PLZ</label>
            <input value={empfaenger.plz ?? ""} onChange={(e) => setEmpf("plz", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Ort</label>
            <input value={empfaenger.ort ?? ""} onChange={(e) => setEmpf("ort", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* Eckdaten */}
      <section className="bg-surface border rounded-xl p-6 shadow-sm grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Rechnungsnummer *</label>
          <input value={rechnungsnummer} onChange={(e) => setRechnungsnummer(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Rechnungsdatum</label>
          <input type="date" value={rechnungsdatumIso} onChange={(e) => setRechnungsdatumIso(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Leistungsdatum / -zeitraum</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Leistung von"
              value={leistungVonIso}
              onChange={(e) => aktualisiereZeitraum(e.target.value, leistungBisIso)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-faint shrink-0">–</span>
            <input
              type="date"
              aria-label="Leistung bis"
              value={leistungBisIso}
              onChange={(e) => aktualisiereZeitraum(leistungVonIso, e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <input
            value={leistungsdatum}
            onChange={(e) => setLeistungsdatum(e.target.value)}
            placeholder="oder frei eingeben, z. B. Juni 2026"
            className="w-full border rounded-lg px-3 py-2 text-sm mt-2"
          />
          <p className="text-xs text-faint mt-1">Von–bis im Kalender wählen (z. B. Monatsende bequem anklicken) — der Zeitraum wird automatisch eingetragen.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Zahlungsziel (Tage)</label>
          <input type="number" value={zahlungszielTage} onChange={(e) => setZahlungszielTage(parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-faint mt-1">Fällig am {faellig}</p>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted mb-1">Betreff</label>
          <input value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder={`Rechnung ${rechnungsnummer}`} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </section>

      {/* Positionen */}
      <section className="bg-surface border rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold">Positionen</h2>
        <div className="space-y-3">
          {positionen.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5">
                {i === 0 && <label className="block text-xs font-medium text-muted mb-1">Beschreibung</label>}
                <input value={p.beschreibung} onChange={(e) => setPos(i, { beschreibung: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                {i === 0 && <label className="block text-xs font-medium text-muted mb-1">Menge</label>}
                <input value={p.mengeText} onChange={(e) => setPos(i, { mengeText: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm text-right" />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs font-medium text-muted mb-1">Einzelpreis netto</label>}
                <input value={p.einzelpreisText} onChange={(e) => setPos(i, { einzelpreisText: e.target.value })} placeholder="0,00" className="w-full border rounded-lg px-2 py-2 text-sm text-right" />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs font-medium text-muted mb-1">MwSt</label>}
                <select
                  value={p.mwst_satz}
                  disabled={kleinunternehmer}
                  onChange={(e) => setPos(i, { mwst_satz: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-2 py-2 text-sm disabled:bg-surface-2 disabled:text-faint"
                >
                  <option value="19">19 %</option>
                  <option value="7">7 %</option>
                  <option value="0">0 %</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                {i === 0 && <label className="block text-xs font-medium text-muted mb-1 w-full">&nbsp;</label>}
                <span className="text-sm font-medium text-ink-soft flex-1 text-right">
                  {formatEuro(parseZahl(p.mengeText) * parseZahl(p.einzelpreisText))}
                </span>
                {positionen.length > 1 && (
                  <button onClick={() => setPositionen((arr) => arr.filter((_, idx) => idx !== i))} className="text-neg hover:text-neg text-lg leading-none">×</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPositionen((arr) => [...arr, leerePosition(kleinunternehmer ? 0 : 19)])}
          className="text-sm text-brand hover:underline"
        >
          + Position hinzufügen
        </button>

        {/* Summen */}
        <div className="border-t pt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            {kleinunternehmer ? (
              <div className="flex justify-between font-bold text-base">
                <span>Gesamtbetrag</span><span>{formatEuro(summen.netto)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-muted">
                  <span>Zwischensumme (netto)</span><span>{formatEuro(summen.netto)}</span>
                </div>
                {summen.mwstGruppen.map((g) => (
                  <div key={g.satz} className="flex justify-between text-muted">
                    <span>zzgl. {g.satz} % MwSt</span><span>{formatEuro(g.steuer)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
                  <span>Rechnungsbetrag</span><span>{formatEuro(summen.brutto)}</span>
                </div>
              </>
            )}
          </div>
        </div>
        {kleinunternehmer && (
          <p className="text-xs text-muted text-right">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>
        )}
      </section>

      {/* Texte */}
      <section className="bg-surface border rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Einleitungstext</label>
          <textarea value={einleitungstext} onChange={(e) => setEinleitungstext(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Fußtext</label>
          <textarea value={fusstext} onChange={(e) => setFusstext(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "offen" | "bezahlt")} className="border rounded-lg px-3 py-2 text-sm">
              <option value="offen">Offen</option>
              <option value="bezahlt">Bezahlt</option>
            </select>
          </div>
          {status === "bezahlt" && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Zahlungsdatum</label>
              <input
                type="date"
                value={zahlungsdatumIso || new Date().toISOString().split("T")[0]}
                onChange={(e) => setZahlungsdatumIso(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      </section>

      <div className="bg-brand-tint border border-line rounded-lg px-4 py-3 text-xs text-brand-ink">
        {status === "bezahlt"
          ? "Diese Rechnung wird mit dem Zahlungsdatum als Einnahme in der EÜR verbucht (Zuflussprinzip §11 EStG)."
          : "Solange die Rechnung „offen“ ist, wird noch keine Einnahme verbucht. Sobald du sie auf „bezahlt“ setzt, erscheint sie in der EÜR."}
      </div>

      <div className="flex gap-2">
        <button onClick={speichernUndPdf} className="bg-brand text-white px-5 py-2.5 rounded-lg hover:bg-brand-deep text-sm font-semibold">
          Speichern & PDF
        </button>
        <button onClick={vorschauOeffnen} className="bg-surface border text-ink-soft px-5 py-2.5 rounded-lg hover:bg-surface-2 text-sm font-medium">
          Vorschau
        </button>
        <button onClick={speichern} className="bg-surface-2 text-ink-soft px-5 py-2.5 rounded-lg hover:bg-line text-sm font-medium">
          Nur speichern
        </button>
        <Link href="/rechnungen" className="px-5 py-2.5 text-sm text-muted hover:underline self-center">Abbrechen</Link>
      </div>

      {vorschau && <RechnungVorschauModal rechnung={vorschau} onClose={() => setVorschau(null)} />}
    </div>
  )
}

export default function RechnungNeuPage() {
  return (
    <Suspense>
      <RechnungNeuContent />
    </Suspense>
  )
}
