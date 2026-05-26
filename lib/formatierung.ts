export function formatEuro(betrag: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(betrag)
}

export function formatDatum(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}.${month}.${year}`
}

export function parseDatumToISO(datum: string): string {
  const [day, month, year] = datum.split(".")
  return `${year}-${month}-${day}`
}
