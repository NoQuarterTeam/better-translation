import { getCookie } from "@tanstack/react-start/server"
import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { membersTable, organizationsTable, type User } from "@/server/db/schema"

export const selectedOrganizationCookieName = "bt_selected_organization_id"
export const selectedProjectCookieName = "bt_selected_project_id"

export async function getDefaultOrganizationForUser(user: Pick<User, "id">) {
  const selectedOrganizationId = getCookie(selectedOrganizationCookieName)

  if (selectedOrganizationId) {
    const [organization] = await db
      .select({ id: organizationsTable.id, slug: organizationsTable.slug })
      .from(membersTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, membersTable.organizationId))
      .where(and(eq(membersTable.userId, user.id), eq(organizationsTable.id, selectedOrganizationId)))
      .limit(1)

    if (organization) return organization
  }

  const [organization] = await db
    .select({ id: organizationsTable.id, slug: organizationsTable.slug })
    .from(membersTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, membersTable.organizationId))
    .where(eq(membersTable.userId, user.id))
    .orderBy(desc(organizationsTable.createdAt))
    .limit(1)

  return organization ?? null
}

export async function listUserOrganizations(user: Pick<User, "id">) {
  return db
    .select({
      id: organizationsTable.id,
      logo: organizationsTable.logo,
      name: organizationsTable.name,
      slug: organizationsTable.slug,
    })
    .from(membersTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, membersTable.organizationId))
    .where(eq(membersTable.userId, user.id))
    .orderBy(asc(organizationsTable.name))
}

export async function listOrganizationProjects(organizationId: string) {
  const projects = await db.query.projectsTable.findMany({
    columns: {
      defaultBranchId: true,
      id: true,
      name: true,
      publicId: true,
      slug: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
    where: { organizationId },
    with: {
      branches: {
        columns: {
          id: true,
          name: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      defaultBranch: { columns: { name: true } },
    },
  })

  return projects.map(({ defaultBranch, ...project }) => ({
    ...project,
    branches: project.branches
      .map((branch) => ({
        ...branch,
        isDefault: branch.id === project.defaultBranchId,
      }))
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault)),
    defaultBranchName: defaultBranch?.name ?? null,
    selectedBranchName: getCookie(getSelectedBranchCookieName(project.publicId)) ?? null,
  }))
}

export function getSelectedBranchCookieName(projectPublicId: string) {
  return `bt_selected_branch_${projectPublicId}`
}
