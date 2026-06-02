import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { db } from "@/server/db"
import { branchesTable, messagesTable } from "@/server/db/schema"
import { withProjectIconUrl } from "@/server/profile-images"

export const listProjectsFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const projects = await db.query.projectsTable.findMany({
      orderBy: { updatedAt: "desc" },
      where: { organizationId: context.organization.id },
    })

    return Promise.all(
      projects.map(async (project) => {
        const activeBranches = await db
          .select({
            id: branchesTable.id,
            lastSyncedAt: branchesTable.lastSyncedAt,
            locales: branchesTable.locales,
          })
          .from(branchesTable)
          .where(and(eq(branchesTable.projectId, project.id), isNull(branchesTable.archivedAt)))
          .orderBy(desc(branchesTable.updatedAt))

        const [messageCount] =
          activeBranches.length === 0
            ? [{ count: 0 }]
            : await db
                .select({ count: count() })
                .from(messagesTable)
                .where(
                  and(
                    eq(messagesTable.projectId, project.id),
                    eq(messagesTable.active, true),
                    inArray(
                      messagesTable.branchId,
                      activeBranches.map((branch) => branch.id),
                    ),
                  ),
                )

        const locales = [...new Set(activeBranches.flatMap((branch) => branch.locales))].sort()

        return {
          ...project,
          activeBranchCount: activeBranches.length,
          lastSyncedAt:
            activeBranches
              .map((branch) => branch.lastSyncedAt)
              .filter((lastSyncedAt) => lastSyncedAt !== null)
              .sort((first, second) => second.getTime() - first.getTime())[0] ?? null,
          locales,
          messageCount: Number(messageCount?.count ?? 0),
          ...(await withProjectIconUrl(project)),
        }
      }),
    )
  })

export const projectsQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["projects", orgSlug],
    queryFn: () => listProjectsFn({ data: { orgSlug } }),
  })
