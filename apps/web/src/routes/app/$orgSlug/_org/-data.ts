import { createServerFn } from "@tanstack/react-start"
import { and, count, desc, eq, isNull } from "drizzle-orm"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { apiKeysTable, branchesTable, localeValuesTable, messagesTable, projectsTable } from "@/server/db/schema"
import { getCurrentOrganizationAccess } from "@/server/organizations"

const orgInputSchema = z.object({ orgSlug: z.string().trim().min(1) })

export const getOrganizationOverviewFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(orgInputSchema))
  .handler(async ({ context, data }) => {
    const organizationAccess = await getCurrentOrganizationAccess({ slug: data.orgSlug, userId: context.user.id })
    if (!organizationAccess) throw new Error("Organization not found.")
    const organizationId = organizationAccess.organization.id

    const [projectCount] = await db
      .select({ count: count() })
      .from(projectsTable)
      .where(eq(projectsTable.organizationId, organizationId))
    const [branchCount] = await db
      .select({ count: count() })
      .from(branchesTable)
      .innerJoin(projectsTable, eq(branchesTable.projectId, projectsTable.id))
      .where(eq(projectsTable.organizationId, organizationId))
    const [messageCount] = await db
      .select({ count: count() })
      .from(messagesTable)
      .innerJoin(projectsTable, eq(messagesTable.projectId, projectsTable.id))
      .where(and(eq(projectsTable.organizationId, organizationId), eq(messagesTable.active, true)))
    const [activeApiKeyCount] = await db
      .select({ count: count() })
      .from(apiKeysTable)
      .innerJoin(projectsTable, eq(apiKeysTable.projectId, projectsTable.id))
      .where(and(eq(projectsTable.organizationId, organizationId), isNull(apiKeysTable.revokedAt)))

    const recentProjects = await db
      .select({
        id: projectsTable.id,
        publicId: projectsTable.publicId,
        name: projectsTable.name,
        defaultLocale: projectsTable.defaultLocale,
        locales: projectsTable.locales,
        updatedAt: projectsTable.updatedAt,
      })
      .from(projectsTable)
      .where(eq(projectsTable.organizationId, organizationId))
      .orderBy(desc(projectsTable.updatedAt))
      .limit(5)

    const overrideCounts = await Promise.all(
      recentProjects.map(async (project) => {
        const [valueCount] = await db
          .select({ count: count() })
          .from(localeValuesTable)
          .where(eq(localeValuesTable.projectId, project.id))

        return [project.id, Number(valueCount?.count ?? 0)] as const
      }),
    )

    return {
      activeApiKeyCount: Number(activeApiKeyCount?.count ?? 0),
      branchCount: Number(branchCount?.count ?? 0),
      messageCount: Number(messageCount?.count ?? 0),
      organization: organizationAccess.organization,
      projectCount: Number(projectCount?.count ?? 0),
      recentProjects: recentProjects.map((project) => ({
        ...project,
        overrideCount: new Map(overrideCounts).get(project.id) ?? 0,
      })),
    }
  })
