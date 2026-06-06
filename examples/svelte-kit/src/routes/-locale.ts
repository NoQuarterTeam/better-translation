import { locales, type Locale } from "better-translation/messages"

export const LOCALE_COOKIE = "locale"
export const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
export const DEFAULT_LOCALE: Locale = "nl"

export function resolveLocale(locale: unknown): Locale | undefined {
  return typeof locale === "string" && (locales as readonly string[]).includes(locale) ? (locale as Locale) : undefined
}

export function resolvePreferredLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const locale = resolveLocale(preference.toLowerCase().split("-")[0])
    if (locale) return locale
  }

  return DEFAULT_LOCALE
}

export function readAcceptLanguage(headers: Headers): string[] {
  const header = headers.get("accept-language")
  return header
    ? header
        .split(",")
        .map((entry) => entry.trim().split(";")[0])
        .filter((entry): entry is string => Boolean(entry))
    : []
}
