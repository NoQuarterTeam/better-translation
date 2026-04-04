import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import * as z from "zod"

import { parseZod } from "@/lib/functions/middleware"
import { auth } from "@/server/auth"

export const getOrganizationInvitationFn = createServerFn({ method: "GET" })
  .inputValidator(parseZod(z.object({ invitationId: z.string().trim().min(1) })))
  .handler(async ({ data }) => {
    return auth.api.getInvitation({
      query: { id: data.invitationId },
      headers: getRequestHeaders(),
    })
  })
