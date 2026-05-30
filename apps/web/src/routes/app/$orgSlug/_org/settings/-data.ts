import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { organizationsTable } from "@/server/db/schema"
import { getCurrentOrganizationAccess } from "@/server/organizations"

const updateOrganizationNameInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
})

export const updateOrganizationNameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(updateOrganizationNameInputSchema))
  .handler(async ({ context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })
    if (!organizationAccess) throw new Error("Organization not found.")

    const [organization] = await db
      .update(organizationsTable)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(organizationsTable.id, organizationAccess.organization.id))
      .returning()

    if (!organization) throw new Error("Could not update organization.")
    return organization
  })
