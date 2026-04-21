import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

import { locales, type AppLocale } from "@/lib/bt/load-messages"

export type { AppLocale }

export const LOCALE_COOKIE = "locale"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function resolveLocale(locale: unknown): AppLocale {
  return typeof locale === "string" && (locales as readonly string[]).includes(locale) ? (locale as AppLocale) : "en"
}

function readClientCookie(): string | undefined {
  const raw = document.cookie.split("; ").find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
  return raw ? decodeURIComponent(raw.slice(LOCALE_COOKIE.length + 1)) : undefined
}

export const getLocale = createIsomorphicFn()
  .server((): AppLocale => resolveLocale(getCookie(LOCALE_COOKIE)))
  .client((): AppLocale => resolveLocale(readClientCookie()))

export function setLocale(locale: AppLocale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`
}
