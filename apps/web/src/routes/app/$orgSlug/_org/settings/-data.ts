import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { hasOrganizationAccess, type OrganizationRole } from "@/lib/auth/permissions"
import { organizationMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { organizationsTable } from "@/server/db/schema"
import { updateOrganizationLogoVersion, withOrganizationLogoUrl } from "@/server/profile-images"
import { deleteStorageObject, getOrganizationLogoKey, headStorageObject } from "@/server/storage"

export const getOrganizationSettingsFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    return withOrganizationLogoUrl({
      id: context.organization.id,
      logo: context.organization.logo,
      name: context.organization.name,
      slug: context.organization.slug,
    })
  })

export const updateOrganizationNameFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .validator(
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
    return withOrganizationLogoUrl(organization)
  })

export const confirmOrganizationLogoUploadFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .validator(
    parseZod(
      z.object({
        sourceKey: z.string().trim().min(1).max(1024),
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    assertCanUpdateOrganization(context.member.role)

    const sourceKey = getOrganizationLogoKey(context.organization.id)
    if (data.sourceKey !== sourceKey) throw new Error("Logo upload does not match this organization.")

    await headStorageObject(sourceKey)
    await updateOrganizationLogoVersion(context.organization.id)

    const organization = await db.query.organizationsTable.findFirst({ where: { id: context.organization.id } })
    if (!organization) throw new Error("Organization not found.")

    return withOrganizationLogoUrl(organization)
  })

export const removeOrganizationLogoFn = createServerFn({ method: "POST" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    assertCanUpdateOrganization(context.member.role)

    await deleteStorageObject(getOrganizationLogoKey(context.organization.id)).catch(() => undefined)

    const [organization] = await db
      .update(organizationsTable)
      .set({ logo: null, updatedAt: new Date() })
      .where(eq(organizationsTable.id, context.organization.id))
      .returning()

    if (!organization) throw new Error("Could not remove organization logo.")

    return withOrganizationLogoUrl(organization)
  })

export const organizationSettingsQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["organization-settings", orgSlug],
    queryFn: () => getOrganizationSettingsFn({ data: { orgSlug } }),
  })

function assertCanUpdateOrganization(role: string) {
  if (!hasOrganizationAccess(role as OrganizationRole, { permissions: { organization: ["update"] } })) {
    throw new Error("You do not have permission to update organization settings.")
  }
}
