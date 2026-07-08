"use client"

import { useEffect } from "react"
import { exportiereBelege, speichereBackupZeitstempel, DATEN_GEAENDERT } from "@/lib/storage"
import { getBackupHandle, speichereAutoBackupZeitstempel } from "@/lib/backupHandle"

export default function AutoBackup() {
  useEffect(() => {
    async function schreibeBackup() {
      const handle = await getBackupHandle()
      if (!handle) return

      try {
        const perm = await handle.queryPermission({ mode: "readwrite" })
        if (perm !== "granted") return

        const inhalt = await exportiereBelege()
        const writable = await handle.createWritable()
        await writable.write(inhalt)
        await writable.close()
        speichereAutoBackupZeitstempel()
        speichereBackupZeitstempel()
      } catch {
        // Berechtigung entzogen oder Datei gelöscht — still überspringen
      }
    }

    // Nach jeder Datenänderung sichern, leicht entzerrt (Debounce),
    // damit nicht bei jedem Tastendruck geschrieben wird.
    let timer: ReturnType<typeof setTimeout> | null = null
    function onAenderung() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(schreibeBackup, 1500)
    }

    function onHide() {
      if (document.visibilityState === "hidden") schreibeBackup()
    }

    window.addEventListener(DATEN_GEAENDERT, onAenderung)
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", schreibeBackup)

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(DATEN_GEAENDERT, onAenderung)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", schreibeBackup)
    }
  }, [])

  return null
}
