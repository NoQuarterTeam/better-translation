import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { organizationsTable } from "@/server/db/schema"

export const getOrganizationSettingsFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    return {
      id: context.organization.id,
      name: context.organization.name,
      slug: context.organization.slug,
    }
  })

export const updateOrganizationNameFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        name: z.string().trim().min(1).max(120),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const [organization] = await db
      .update(organizationsTable)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(organizationsTable.id, context.organization.id))
      .returning()

    if (!organization) throw new Error("Could not update organization.")
    return organization
  })

export const organizationSettingsQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["organization-settings", orgSlug],
    queryFn: () => getOrganizationSettingsFn({ data: { orgSlug } }),
  })
