"use client"

import { useState, useEffect, useRef } from "react"
import {
  exportiereBelege, importiereDaten, ladeVorlagen, loescheVorlage,
  speichereBackupZeitstempel, ladeBackupZeitstempel,
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
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        importiereDaten(ev.target?.result as string)
        setImportStatus("ok")
        setVorlagen(ladeVorlagen())
        setTimeout(() => window.location.reload(), 1500)
      } catch {
        setImportStatus("fehler")
      }
    }
    reader.readAsText(file)
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
        <section className="bg-white border rounded-xl p-6 shadow-sm space-y-3">
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
          <p className="text-sm text-gray-500">
            Wähle einmal eine Datei auf deinem Computer — die App überschreibt sie automatisch
            wenn du den Tab verlässt oder das Fenster schließt.
          </p>

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
          <p className="text-sm text-red-600 font-medium">Fehler beim Import — Datei prüfen.</p>
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
    </div>
  )
}
