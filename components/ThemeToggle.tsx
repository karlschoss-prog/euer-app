"use client"

import { useEffect, useState } from "react"

type Theme = "light" | "dark"

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")

  // Aktuellen Modus vom <html>-Attribut übernehmen (wurde vom Inline-Script gesetzt).
  useEffect(() => {
    const aktuell = (document.documentElement.getAttribute("data-theme") as Theme) || "light"
    setTheme(aktuell)
  }, [])

  function umschalten() {
    const naechster: Theme = theme === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", naechster)
    try { localStorage.setItem("theme", naechster) } catch {}
    setTheme(naechster)
  }

  const dunkel = theme === "dark"

  return (
    <button
      onClick={umschalten}
      aria-label={dunkel ? "Zu hellem Modus wechseln" : "Zu dunklem Modus wechseln"}
      title={dunkel ? "Heller Modus" : "Dunkler Modus"}
      className="flex items-center gap-2 text-xs font-medium text-muted hover:text-ink-soft transition-colors"
    >
      <span className="grid place-items-center w-7 h-7 rounded-lg border border-line bg-surface-2">
        {dunkel ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm5.66 2.34a1 1 0 010 1.42l-.7.7a1 1 0 11-1.42-1.42l.7-.7a1 1 0 011.42 0zM18 9a1 1 0 110 2h-1a1 1 0 110-2h1zM6.46 5.46a1 1 0 01-1.42 1.42l-.7-.7A1 1 0 015.76 4.76l.7.7zM4 9a1 1 0 110 2H3a1 1 0 110-2h1zm10.24 5.24a1 1 0 011.42 0l.7.7a1 1 0 11-1.42 1.42l-.7-.7a1 1 0 010-1.42zM10 6a4 4 0 100 8 4 4 0 000-8zm-4.24 8.24a1 1 0 010 1.42l-.7.7a1 1 0 11-1.42-1.42l.7-.7a1 1 0 011.42 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </span>
      {dunkel ? "Heller Modus" : "Dunkler Modus"}
    </button>
  )
}
