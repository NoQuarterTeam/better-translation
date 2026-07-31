import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import * as z from "zod"

import { parseZod } from "@/lib/functions/zod"
import { auth } from "@/server/auth"

export const getOrganizationInvitationFn = createServerFn({ method: "GET" })
  .validator(parseZod(z.object({ invitationId: z.string().trim().min(1) })))
  .handler(async ({ data }) => {
    return auth.api.getInvitation({
      query: { id: data.invitationId },
      headers: getRequestHeaders(),
    })
  })

export const organizationInvitationQueryOptions = (invitationId: string) =>
  queryOptions({
    queryKey: ["organization-invitation", invitationId],
    queryFn: () => getOrganizationInvitationFn({ data: { invitationId } }),
  })
