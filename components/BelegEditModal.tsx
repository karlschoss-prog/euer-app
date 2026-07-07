"use client"

import { Beleg } from "@/types/beleg"
import BelegForm, { BelegFormData } from "@/components/BelegForm"

interface BelegEditModalProps {
  beleg: Beleg
  onSpeichern: (data: BelegFormData) => void
  onAbbrechen: () => void
}

export default function BelegEditModal({ beleg, onSpeichern, onAbbrechen }: BelegEditModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onAbbrechen() }}
    >
      <div className="bg-surface border border-line rounded-2xl shadow-card-lg w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-ink">
            {beleg.typ === "einnahme" ? "Einnahme" : "Ausgabe"} bearbeiten
          </h2>
          <button onClick={onAbbrechen} className="text-faint hover:text-ink text-xl leading-none">✕</button>
        </div>
        <BelegForm typ={beleg.typ} initialData={beleg} onSpeichern={onSpeichern} />
      </div>
    </div>
  )
}
