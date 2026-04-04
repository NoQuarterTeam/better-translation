import { createServerFn } from "@tanstack/react-start"
import * as z from "zod"

import { getMessages } from "@better-translate/vite/server"

export const getI18nMessagesFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ locale: z.string() }))
  .handler(async ({ data }) => {
    return getMessages(data.locale, { storage: { type: "local", dir: "locales" } })
  })
