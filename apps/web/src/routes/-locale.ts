import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import z from "zod"

import { locales, type Locale } from "better-translation/messages"

export const LOCALE_COOKIE = "locale"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function resolveLocale(locale: unknown): Locale {
  return typeof locale === "string" && (locales as readonly string[]).includes(locale) ? (locale as Locale) : "en"
}

export const getLocaleFn = createServerFn({ method: "GET" }).handler((): Locale => resolveLocale(getCookie(LOCALE_COOKIE)))

export const setLocaleFn = createServerFn({ method: "POST" })
  .validator(z.object({ locale: z.string() }))
  .handler(({ data }) => {
    setCookie(LOCALE_COOKIE, resolveLocale(data.locale), {
      httpOnly: true,
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  })
