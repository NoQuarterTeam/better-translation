import { getCookie } from "@tanstack/react-start/server"
import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { membersTable, organizationsTable, type User } from "@/server/db/schema"
import { withOrganizationLogoUrl } from "@/server/profile-images"

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
  const organizations = await db
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

  return Promise.all(organizations.map((organization) => withOrganizationLogoUrl(organization)))
}
