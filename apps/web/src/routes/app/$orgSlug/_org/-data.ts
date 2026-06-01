import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { and, count, eq, isNull } from "drizzle-orm"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { db } from "@/server/db"
import { apiKeysTable, branchesTable, localeValuesTable, messagesTable, projectsTable } from "@/server/db/schema"

export const getOrganizationOverviewFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const organizationId = context.organization.id

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

    const recentProjects = await db.query.projectsTable.findMany({
      columns: {
        id: true,
        name: true,
        publicId: true,
        slug: true,
        updatedAt: true,
      },
      limit: 5,
      orderBy: { updatedAt: "desc" },
      where: { organizationId },
    })

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
      organization: context.organization,
      projectCount: Number(projectCount?.count ?? 0),
      recentProjects: recentProjects.map((project) => ({
        ...project,
        overrideCount: new Map(overrideCounts).get(project.id) ?? 0,
      })),
    }
  })

export const organizationOverviewQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["organization-overview", orgSlug],
    queryFn: () => getOrganizationOverviewFn({ data: { orgSlug } }),
  })
