"use client"

import { useEffect } from "react"
import { exportiereBelege } from "@/lib/storage"
import { getBackupHandle, speichereAutoBackupZeitstempel } from "@/lib/backupHandle"

export default function AutoBackup() {
  useEffect(() => {
    async function schreibeBackup() {
      const handle = await getBackupHandle()
      if (!handle) return

      try {
        const perm = await handle.queryPermission({ mode: "readwrite" })
        if (perm !== "granted") return

        const writable = await handle.createWritable()
        await writable.write(exportiereBelege())
        await writable.close()
        speichereAutoBackupZeitstempel()
      } catch {
        // Permission revoked or file deleted — silently skip
      }
    }

    function onHide() {
      if (document.visibilityState === "hidden") schreibeBackup()
    }

    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", schreibeBackup)

    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", schreibeBackup)
    }
  }, [])

  return null
}
