export type BelegTyp = "einnahme" | "ausgabe"

export interface Beleg {
  id: string
  typ: BelegTyp
  datum: string           // TT.MM.JJJJ
  belegnummer?: string
  kunde_lieferant?: string
  leistungsbeschreibung: string
  menge: number
  einzelpreis: number
  gesamtpreis: number
  mwst_satz: number
  nettobetrag: number
  bruttobetrag: number
  kategorie?: string
  erstellt_am: string
}

export interface Vorlage {
  id: string
  name: string
  typ: BelegTyp
  leistungsbeschreibung: string
  kunde_lieferant?: string
  menge: number
  einzelpreis: number
  mwst_satz: number
  kategorie?: string
}
