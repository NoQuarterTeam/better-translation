import { fail } from "@sveltejs/kit"

import type { Actions } from "./$types"

import { LOCALE_COOKIE, ONE_YEAR_SECONDS, resolveLocale } from "./-locale"

export const actions: Actions = {
  setLocale: async ({ cookies, request, url }) => {
    const locale = resolveLocale((await request.formData()).get("locale"))
    if (!locale) return fail(400)

    cookies.set(LOCALE_COOKIE, locale, {
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: url.protocol === "https:",
    })
  },
}
