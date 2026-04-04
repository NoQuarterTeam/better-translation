import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { getMessages } from "@better-translate/vite/server"

import { getSession } from "@/server/sessions"

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(() => {
  return getSession()
})

export const getI18nMessagesFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ locale: z.string() }))
  .handler(async ({ data }) => {
    return getMessages(data.locale, { storage: { type: "local", dir: "locales" } })
  })
