import { getCookie } from "@tanstack/react-start/server"
import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { membersTable, organizationsTable, projectsTable, type User } from "@/server/db/schema"

export const selectedOrganizationCookieName = "bt_selected_organization_id"
export const selectedProjectCookieName = "bt_selected_project_id"

export async function getDefaultOrganizationForUser(user: Pick<User, "id">) {
  const selectedOrganizationId = getCookie(selectedOrganizationCookieName)

  if (selectedOrganizationId) {
    const [organization] = await db
      .select({ id: organizationsTable.id, slug: organizationsTable.slug })
      .from(membersTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, membersTable.organizationId))
      .where(and(eq(membersTable.userId, user.id), eq(organizationsTable.id, Number(selectedOrganizationId))))
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

export async function getCurrentOrganizationAccess(params: { slug: string; userId: number }) {
  const [organizationAccess] = await db
    .select({
      organization: organizationsTable,
      member: { id: membersTable.id, role: membersTable.role },
    })
    .from(membersTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, membersTable.organizationId))
    .where(and(eq(membersTable.userId, params.userId), eq(organizationsTable.slug, params.slug)))
    .limit(1)

  return organizationAccess ?? null
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

export async function listOrganizationProjects(organizationId: number) {
  return db
    .select({
      defaultLocale: projectsTable.defaultLocale,
      id: projectsTable.id,
      locales: projectsTable.locales,
      name: projectsTable.name,
      publicId: projectsTable.publicId,
      slug: projectsTable.slug,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .where(eq(projectsTable.organizationId, organizationId))
    .orderBy(asc(projectsTable.name))
}
