import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { and, count, eq } from "drizzle-orm"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { db } from "@/server/db"
import { branchesTable, messagesTable } from "@/server/db/schema"

export const listProjectsFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const projects = await db.query.projectsTable.findMany({
      orderBy: { updatedAt: "desc" },
      where: { organizationId: context.organization.id },
    })

    return Promise.all(
      projects.map(async (project) => {
        const [branchCount] = await db
          .select({ count: count() })
          .from(branchesTable)
          .where(eq(branchesTable.projectId, project.id))
        const [messageCount] = await db
          .select({ count: count() })
          .from(messagesTable)
          .where(and(eq(messagesTable.projectId, project.id), eq(messagesTable.active, true)))

        return {
          ...project,
          branchCount: Number(branchCount?.count ?? 0),
          messageCount: Number(messageCount?.count ?? 0),
        }
      }),
    )
  })

export const projectsQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["projects", orgSlug],
    queryFn: () => listProjectsFn({ data: { orgSlug } }),
  })
