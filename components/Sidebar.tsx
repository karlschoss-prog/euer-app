"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "@/components/ThemeToggle"

const LINKS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
  },
  {
    href: "/einnahmen",
    label: "Einnahmen",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/ausgaben",
    label: "Ausgaben",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V5z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/inbox",
    label: "Beleg-Inbox",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v6h-2.586a1 1 0 00-.707.293l-1.121 1.121a1 1 0 01-.707.293H9.828a1 1 0 01-.707-.293l-1.121-1.121A1 1 0 007.293 11H5V5z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/rechnungen",
    label: "Rechnungen",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h5.586A2 2 0 0113 2.586L16.414 6A2 2 0 0117 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 3a1 1 0 011-1h2a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/mahnungen",
    label: "Mahnungen",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/kunden",
    label: "Kunden",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    ),
  },
  {
    href: "/unternehmen",
    label: "Unternehmen",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v14a1 1 0 01-1 1h-3v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3H5a1 1 0 01-1-1V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/jahresuebersicht",
    label: "Jahresübersicht",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    href: "/umsatzsteuer",
    label: "Umsatzsteuer",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M15.707 4.293a1 1 0 010 1.414l-10 10a1 1 0 01-1.414-1.414l10-10a1 1 0 011.414 0zM6.5 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 7a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/export",
    label: "PDF-Export",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/daten",
    label: "Backup",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-surface border-r border-line flex flex-col shrink-0 sticky top-0 self-start h-screen">
      {/* Marke */}
      <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-5">
        <svg viewBox="0 0 32 32" aria-hidden="true" className="w-9 h-9 rounded-[9px] shadow-[0_4px_10px_rgba(37,99,235,0.32)]">
          <defs>
            <linearGradient id="sb-euro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="7" fill="url(#sb-euro)" />
          <text x="16" y="16.5" textAnchor="middle" dominantBaseline="central"
                fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" fill="#fff">€</text>
        </svg>
        <span className="font-bold text-ink text-lg tracking-tight">E<span className="text-brand">Ü</span>R-App</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? "bg-brand-tint text-brand-ink font-semibold"
                  : "text-muted hover:bg-surface-2 hover:text-ink-soft"
              }`}
            >
              <span className={active ? "text-brand" : "text-faint"}>{l.icon}</span>
              {l.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer: Modus-Umschalter + Status */}
      <div className="px-5 py-4 border-t border-line flex flex-col gap-3">
        <ThemeToggle />
        <span className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-pos shadow-[0_0_0_3px_var(--pos-tint)]" />
          Lokal gespeichert
        </span>
      </div>
    </aside>
  )
}
