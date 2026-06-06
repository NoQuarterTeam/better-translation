import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server"

import { locales, type Locale } from "better-translation/messages"

export const LOCALE_COOKIE = "locale"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const DEFAULT_LOCALE: Locale = "nl"

function resolveLocale(locale: unknown): Locale | undefined {
  return typeof locale === "string" && (locales as readonly string[]).includes(locale) ? (locale as Locale) : undefined
}

function resolvePreferredLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const locale = resolveLocale(preference.toLowerCase().split("-")[0])
    if (locale) return locale
  }

  return DEFAULT_LOCALE
}

function readAcceptLanguage(): string[] {
  const header = getRequestHeaders().get("accept-language")
  return header
    ? header
        .split(",")
        .map((entry) => entry.trim().split(";")[0])
        .filter((entry): entry is string => Boolean(entry))
    : []
}

function readClientCookie(): string | undefined {
  const raw = document.cookie.split("; ").find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
  return raw ? decodeURIComponent(raw.slice(LOCALE_COOKIE.length + 1)) : undefined
}

export const getLocale = createIsomorphicFn()
  .server((): Locale => resolveLocale(getCookie(LOCALE_COOKIE)) ?? resolvePreferredLocale(readAcceptLanguage()))
  .client((): Locale => {
    const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language]
    return resolveLocale(readClientCookie()) ?? resolvePreferredLocale(languages)
  })

export function setLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`
}
