import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { getNitroMessages } from "@better-translate/vite/nitro"

import { getSession } from "@/server/sessions"

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(() => {
  return getSession()
})

export const getTranslateMessagesFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ locale: z.string() }))
  .handler(async ({ data }) => {
    return getNitroMessages(data.locale, { mount: "locales", dir: "assets/locales" })
  })
