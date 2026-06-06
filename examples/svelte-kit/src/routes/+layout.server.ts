import { loadMessages, locales } from "better-translation/messages"

import type { LayoutServerLoad } from "./$types"

import { LOCALE_COOKIE, readAcceptLanguage, resolveLocale, resolvePreferredLocale } from "./-locale"

export const load: LayoutServerLoad = async ({ cookies, request }) => {
  const locale = resolveLocale(cookies.get(LOCALE_COOKIE)) ?? resolvePreferredLocale(readAcceptLanguage(request.headers))

  return {
    locale,
    locales,
    messages: await loadMessages(locale).catch(() => ({})),
  }
}
