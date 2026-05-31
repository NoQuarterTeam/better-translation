import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { count, eq, inArray } from "drizzle-orm"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { branchInsertSchema, branchesTable, localeValuesTable, projectsTable } from "@/server/db/schema"

export const listProjectBranchesFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => {
    const { project } = context
    const branches = await db.query.branchesTable.findMany({
      orderBy: { updatedAt: "desc" },
      where: { projectId: project.id },
    })

    const valueCounts =
      branches.length === 0
        ? []
        : await db
            .select({ branchId: localeValuesTable.branchId, count: count() })
            .from(localeValuesTable)
            .where(
              inArray(
                localeValuesTable.branchId,
                branches.map((branch) => branch.id),
              ),
            )
            .groupBy(localeValuesTable.branchId)

    const valueCountByBranchId = new Map(valueCounts.map((row) => [row.branchId, Number(row.count)]))

    return {
      branches: branches
        .map((branch) => ({
          ...branch,
          isDefault: branch.id === project.defaultBranchId,
          valueCount: valueCountByBranchId.get(branch.id) ?? 0,
        }))
        .sort((left, right) => Number(right.isDefault) - Number(left.isDefault)),
      defaultBranchName: branches.find((branch) => branch.id === project.defaultBranchId)?.name ?? null,
    }
  })

export const createProjectBranchFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(z.object({ name: branchInsertSchema.shape.name })))
  .handler(async ({ context, data }) => {
    const { project } = context
    const existingBranch = await db.query.branchesTable.findFirst({
      columns: { id: true },
      where: { projectId: project.id },
    })

    if (existingBranch) throw new Error("Branches are created by Manifest sync after the first Branch exists.")

    const [branch] = await db
      .insert(branchesTable)
      .values({
        name: data.name,
        projectId: project.id,
      })
      .returning()

    if (!branch) throw new Error("Could not create Branch.")

    await db.update(projectsTable).set({ defaultBranchId: branch.id }).where(eq(projectsTable.id, project.id))

    return branch
  })

export const updateProjectBranchFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(
    parseZod(
      z.object({
        branchId: z.string().trim().min(1),
        name: branchInsertSchema.shape.name,
      }),
    ),
  )
  .handler(async ({ context, data }) => {
    const { project } = context
    await ensureBranchBelongsToProject(project.id, data.branchId)

    const duplicateBranch = await db.query.branchesTable.findFirst({
      columns: { id: true },
      where: { projectId: project.id, name: data.name },
    })

    if (duplicateBranch && duplicateBranch.id !== data.branchId) throw new Error("A Branch with that name already exists.")

    const [branch] = await db
      .update(branchesTable)
      .set({ name: data.name })
      .where(eq(branchesTable.id, data.branchId))
      .returning()

    if (!branch) throw new Error("Could not update Branch.")

    return branch
  })

export const setDefaultProjectBranchFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(z.object({ branchId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    const { project } = context
    const branch = await ensureBranchBelongsToProject(project.id, data.branchId)

    await db.update(projectsTable).set({ defaultBranchId: branch.id }).where(eq(projectsTable.id, project.id))

    return branch
  })

export const projectBranchesQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["project-branches", orgSlug, projectSlug],
    queryFn: () => listProjectBranchesFn({ data: { orgSlug, projectSlug } }),
  })

async function ensureBranchBelongsToProject(projectId: string, branchId: string) {
  const branch = await db.query.branchesTable.findFirst({
    where: { id: branchId, projectId },
  })

  if (!branch) throw new Error("Branch not found.")
  return branch
}
