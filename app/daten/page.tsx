"use client"

import { useState, useEffect, useRef } from "react"
import {
  exportiereBelege, importiereDaten, ladeVorlagen, loescheVorlage,
  speichereBackupZeitstempel, ladeBackupZeitstempel, setzeAllesZurueck,
} from "@/lib/storage"
import {
  getBackupHandle, setBackupHandle, clearBackupHandle,
  ladeAutoBackupZeitstempel, isFileSystemAccessSupported,
} from "@/lib/backupHandle"
import { Vorlage } from "@/types/beleg"
import Toast from "@/components/Toast"

function backupAlterText(iso: string | null): { text: string; dringend: boolean } {
  if (!iso) return { text: "Noch kein Backup erstellt", dringend: true }
  const diff = Date.now() - new Date(iso).getTime()
  const tage = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (tage === 0) return { text: "Heute gesichert", dringend: false }
  if (tage === 1) return { text: "Gestern gesichert", dringend: false }
  if (tage <= 7) return { text: `Vor ${tage} Tagen gesichert`, dringend: false }
  return { text: `Vor ${tage} Tagen gesichert — Backup empfohlen!`, dringend: true }
}

function zeitstempelText(iso: string | null): string {
  if (!iso) return "Noch kein automatisches Backup"
  const d = new Date(iso)
  return `Zuletzt: ${d.toLocaleDateString("de-DE")} um ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`
}

export default function DatenPage() {
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([])
  const [importStatus, setImportStatus] = useState<"idle" | "ok" | "fehler">("idle")
  const [importFehler, setImportFehler] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [backupTs, setBackupTs] = useState<string | null>(null)
  const [autoBackupDatei, setAutoBackupDatei] = useState<string | null>(null)
  const [autoBackupTs, setAutoBackupTs] = useState<string | null>(null)
  const [autoBackupPermission, setAutoBackupPermission] = useState<"granted" | "prompt" | "none">("none")
  const [fsSupported] = useState(() => isFileSystemAccessSupported())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setVorlagen(ladeVorlagen())
    setBackupTs(ladeBackupZeitstempel())
    setAutoBackupTs(ladeAutoBackupZeitstempel())
    ladeHandleInfo()
  }, [])

  async function ladeHandleInfo() {
    const handle = await getBackupHandle()
    if (!handle) { setAutoBackupDatei(null); return }
    setAutoBackupDatei(handle.name)
    const perm = await handle.queryPermission({ mode: "readwrite" })
    setAutoBackupPermission(perm === "granted" ? "granted" : "prompt")
  }

  const { text: backupText, dringend } = backupAlterText(backupTs)

  function handleExport() {
    const json = exportiereBelege()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `euer-backup-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    speichereBackupZeitstempel()
    setBackupTs(ladeBackupZeitstempel())
    setToast("Backup heruntergeladen")
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus("idle")
    setImportFehler(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        importiereDaten(ev.target?.result as string)
        setImportStatus("ok")
        setVorlagen(ladeVorlagen())
        setTimeout(() => window.location.reload(), 1500)
      } catch (err) {
        setImportStatus("fehler")
        setImportFehler(err instanceof Error ? err.message : "Unbekannter Fehler")
      }
    }
    reader.onerror = () => {
      setImportStatus("fehler")
      setImportFehler("Datei konnte nicht gelesen werden.")
    }
    reader.readAsText(file)
  }

  function handleReset() {
    const ok = window.confirm(
      "Wirklich ALLE Daten löschen?\n\n" +
        "Belege, Rechnungen, Kunden und Unternehmensprofile werden unwiderruflich entfernt. " +
        "Falls das automatische Backup aktiv ist, wird auch die Backup-Datei mit leeren Daten überschrieben.\n\n" +
        "Tipp: Vorher „Backup herunterladen“, falls du die aktuellen Daten noch sichern willst."
    )
    if (!ok) return
    setzeAllesZurueck()
    setVorlagen([])
    setToast("Alle Daten wurden gelöscht")
    setTimeout(() => window.location.reload(), 1200)
  }

  function handleVorlageLoeschen(id: string, name: string) {
    if (!window.confirm(`Vorlage "${name}" wirklich löschen?`)) return
    loescheVorlage(id)
    setVorlagen(ladeVorlagen())
    setToast("Vorlage gelöscht")
  }

  async function handleAutoBackupEinrichten() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: "euer-backup.json",
        types: [{ description: "JSON-Backup", accept: { "application/json": [".json"] } }],
      }) as FileSystemFileHandle
      await setBackupHandle(handle)
      setAutoBackupDatei(handle.name)
      setAutoBackupPermission("granted")
      setToast("Automatisches Backup eingerichtet")
    } catch {
      // User cancelled picker
    }
  }

  async function handleBerechtigungErneuern() {
    const handle = await getBackupHandle()
    if (!handle) return
    try {
      const perm = await handle.requestPermission({ mode: "readwrite" })
      setAutoBackupPermission(perm === "granted" ? "granted" : "prompt")
      if (perm === "granted") setToast("Berechtigung bestätigt")
    } catch {
      // ignore
    }
  }

  async function handleAutoBackupEntfernen() {
    await clearBackupHandle()
    setAutoBackupDatei(null)
    setAutoBackupPermission("none")
    setToast("Automatisches Backup deaktiviert")
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">Backup & Daten</h1>
        <div className={`text-sm px-3 py-1.5 rounded-full font-medium ${
          dringend ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
        }`}>
          {dringend ? "⚠ " : "✓ "}{backupText}
        </div>
      </div>

      {/* Automatisches Backup */}
      {fsSupported && (
        <section className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Automatisches Backup</h2>
            {autoBackupDatei && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                autoBackupPermission === "granted"
                  ? "bg-green-100 text-green-700"
                  : "bg-orange-100 text-orange-700"
              }`}>
                {autoBackupPermission === "granted" ? "✓ Aktiv" : "⚠ Berechtigung nötig"}
              </span>
            )}
          </div>

          {/* Erklärung — immer sichtbar */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">So funktioniert's</p>
            <ol className="space-y-1.5">
              {[
                { n: "1", text: "Klicke auf \"Backup-Datei einrichten\" und wähle einen Speicherort (z. B. Dokumente/euer-backup.json)." },
                { n: "2", text: "Ab sofort überschreibt die App diese Datei automatisch nach jeder Änderung — im Hintergrund, ohne Dialog." },
                { n: "3", text: "Nach einem Browser-Neustart einmalig \"Berechtigung bestätigen\" klicken — dann läuft es wieder automatisch." },
              ].map(({ n, text }) => (
                <li key={n} className="flex gap-2 text-xs text-blue-800">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-blue-200 text-blue-700 font-bold flex items-center justify-center text-[10px]">{n}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-blue-600 pt-0.5">Funktioniert in Chrome und Edge. Safari/Firefox: bitte manuellen Export nutzen.</p>
          </div>

          {autoBackupDatei ? (
            <div className="bg-gray-50 border rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">📄</span>
                <span className="font-medium text-gray-700">{autoBackupDatei}</span>
              </div>
              <p className="text-xs text-gray-400">{zeitstempelText(autoBackupTs)}</p>
              <div className="flex gap-2 pt-1">
                {autoBackupPermission !== "granted" && (
                  <button
                    onClick={handleBerechtigungErneuern}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-xs font-medium"
                  >
                    Berechtigung bestätigen
                  </button>
                )}
                <button
                  onClick={handleAutoBackupEinrichten}
                  className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg hover:bg-gray-200 text-xs font-medium"
                >
                  Andere Datei wählen
                </button>
                <button
                  onClick={handleAutoBackupEntfernen}
                  className="text-red-500 hover:text-red-700 text-xs px-2"
                >
                  Deaktivieren
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAutoBackupEinrichten}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Backup-Datei einrichten
            </button>
          )}

          {autoBackupPermission === "prompt" && autoBackupDatei && (
            <p className="text-xs text-orange-600">
              Nach einem Browser-Neustart muss die Berechtigung einmalig bestätigt werden.
            </p>
          )}
        </section>
      )}

      {/* Manuelles Export */}
      <section className="bg-white border rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="text-base font-semibold">Backup manuell exportieren</h2>
        <p className="text-sm text-gray-500">
          Speichert alle Belege und Vorlagen als JSON-Datei. Alle Daten liegen im Browser-LocalStorage
          und gehen beim Löschen des Browser-Caches verloren — regelmäßig sichern.
        </p>
        <button
          onClick={handleExport}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          Backup herunterladen
        </button>
      </section>

      {/* Import */}
      <section className="bg-white border rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="text-base font-semibold">Backup importieren</h2>
        <p className="text-sm text-gray-500">
          Stellt einen vorherigen Backup wieder her.{" "}
          <strong className="text-gray-700">Alle vorhandenen Daten werden überschrieben.</strong>
        </p>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button
          onClick={() => { setImportStatus("idle"); fileRef.current?.click() }}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Backup-Datei auswählen
        </button>
        {importStatus === "ok" && (
          <p className="text-sm text-green-700 font-medium">✓ Import erfolgreich — Seite wird neu geladen…</p>
        )}
        {importStatus === "fehler" && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="font-medium">Import fehlgeschlagen</p>
            <p className="mt-0.5">{importFehler}</p>
            <p className="mt-1 text-xs text-red-500">
              Tipp: Auf dem Quellgerät erneut „Backup herunterladen“ und die Datei direkt (z. B. per AirDrop) übertragen — nicht den Inhalt kopieren/einfügen.
            </p>
          </div>
        )}
      </section>

      {/* Vorlagen */}
      <section className="bg-white border rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="text-base font-semibold">Gespeicherte Vorlagen</h2>
        {vorlagen.length === 0 ? (
          <p className="text-sm text-gray-400">
            Noch keine Vorlagen. In der Einnahmen- oder Ausgaben-Tabelle auf ⭐ klicken.
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="border px-3 py-2">Name</th>
                <th className="border px-3 py-2">Typ</th>
                <th className="border px-3 py-2">Beschreibung</th>
                <th className="border px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {vorlagen.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 font-medium">{v.name}</td>
                  <td className="border px-3 py-2 capitalize text-gray-500">{v.typ}</td>
                  <td className="border px-3 py-2 text-gray-600">{v.leistungsbeschreibung}</td>
                  <td className="border px-3 py-2">
                    <button
                      onClick={() => handleVorlageLoeschen(v.id, v.name)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Gefahrenzone */}
      <section className="bg-white border border-red-200 rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-red-700">Alle Daten löschen</h2>
        <p className="text-sm text-gray-500">
          Setzt die App komplett zurück: Belege, Rechnungen, Kunden, Unternehmensprofile und Vorlagen
          werden unwiderruflich entfernt. Erstelle vorher ein Backup, falls du die Daten behalten möchtest.
        </p>
        <button
          onClick={handleReset}
          className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
        >
          Alle Daten löschen
        </button>
      </section>
    </div>
  )
}
