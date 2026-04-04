import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { authMiddleware } from "@/lib/functions/middleware"
import { auth } from "@/server/auth"

export const listUserOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const organizations = await auth.api.listOrganizations({ headers: getRequestHeaders() })
    return organizations ?? []
  })
