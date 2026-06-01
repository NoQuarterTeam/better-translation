const defaultDisplayLocales = ["en"]

export function formatLocale(locale: string, displayLocales: readonly string[] = defaultDisplayLocales) {
  return new Intl.DisplayNames(displayLocales, { type: "language" }).of(locale) ?? locale
}
