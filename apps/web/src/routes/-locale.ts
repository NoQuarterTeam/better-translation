import * as z from "zod"

export const locales = ["en", "nl", "fr", "es"] as const

export type AppLocale = (typeof locales)[number]

export const localeSearchSchema = z.object({
  locale: z.enum(locales).optional().catch(undefined),
})

export function resolveLocale(locale: unknown): AppLocale {
  return locale === "nl" || locale === "fr" || locale === "es" ? locale : "en"
}
