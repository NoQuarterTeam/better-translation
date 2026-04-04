import { createServerFn } from "@tanstack/react-start"

import { getSession } from "@/server/sessions"

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(() => {
  return getSession()
})
