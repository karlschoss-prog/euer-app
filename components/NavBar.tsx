"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ladeBelege } from "@/lib/storage"
import { berechneJahresEinnahmen } from "@/lib/berechnung"

const LINKS = [
  { href: "/einnahmen", label: "Einnahmen" },
  { href: "/ausgaben", label: "Ausgaben" },
  { href: "/jahresuebersicht", label: "Jahresübersicht" },
  { href: "/export", label: "PDF-Export" },
  { href: "/daten", label: "Backup" },
]

const GRENZE = 22000

export default function NavBar() {
  const pathname = usePathname()
  const [warnstufe, setWarnstufe] = useState<"ok" | "warn" | "kritisch">("ok")

  useEffect(() => {
    const belege = ladeBelege()
    const einnahmen = berechneJahresEinnahmen(belege, new Date().getFullYear())
    if (einnahmen >= GRENZE) setWarnstufe("kritisch")
    else if (einnahmen >= GRENZE * 0.7) setWarnstufe("warn")
    else setWarnstufe("ok")
  }, [])

  return (
    <nav className="bg-surface border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link href="/" className="font-bold text-ink text-base shrink-0">
          EÜR-App
        </Link>
        <div className="flex gap-4 text-sm items-center flex-1">
          {LINKS.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  active
                    ? "text-ink font-semibold border-b-2 border-brand pb-0.5"
                    : "text-muted hover:text-ink"
                }
              >
                {l.label}
              </Link>
            )
          })}
        </div>
        {warnstufe !== "ok" && (
          <Link
            href="/"
            className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 ${
              warnstufe === "kritisch"
                ? "bg-neg-tint text-neg hover:bg-neg-tint"
                : "bg-warn-tint text-warn hover:bg-warn-tint"
            }`}
          >
            {warnstufe === "kritisch" ? "⚠ Grenze überschritten" : "⚠ Grenze in Sichtweite"}
          </Link>
        )}
      </div>
    </nav>
  )
}
