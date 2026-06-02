import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { organizationsTable, projectsTable, type Organization, type Project, type User } from "@/server/db/schema"
import {
  getOrganizationLogoKey,
  getProjectIconKey,
  getSignedImageUrl,
  getUserAvatarKey,
  imageUploadMaxBytes,
  imageUploadMimeTypes,
} from "@/server/storage"

export const organizationLogoMaxBytes = imageUploadMaxBytes
export const organizationLogoUploadMimeTypes = imageUploadMimeTypes
export const projectIconMaxBytes = imageUploadMaxBytes
export const projectIconUploadMimeTypes = imageUploadMimeTypes
export const userAvatarMaxBytes = imageUploadMaxBytes
export const userAvatarUploadMimeTypes = imageUploadMimeTypes

export function getImageVersion() {
  return new Date().toISOString()
}

export async function resolveOrganizationLogoUrl(organization: Pick<Organization, "id" | "logo">) {
  if (!organization.logo) return null

  try {
    return await getSignedImageUrl(getOrganizationLogoKey(organization.id))
  } catch {
    return null
  }
}

export async function withOrganizationLogoUrl<T extends Pick<Organization, "id" | "logo">>(organization: T) {
  return { ...organization, logoUrl: await resolveOrganizationLogoUrl(organization) }
}

export async function resolveProjectIconUrl(project: Pick<Project, "id" | "icon">) {
  if (!project.icon) return null

  try {
    return await getSignedImageUrl(getProjectIconKey(project.id))
  } catch {
    return null
  }
}

export async function withProjectIconUrl<T extends Pick<Project, "id" | "icon">>(project: T) {
  return { ...project, iconUrl: await resolveProjectIconUrl(project) }
}

export async function resolveUserAvatarUrl(user: Pick<User, "id" | "image">) {
  if (!user.image) return null

  try {
    return await getSignedImageUrl(getUserAvatarKey(user.id))
  } catch {
    return null
  }
}

export async function withUserAvatarUrl<T extends Pick<User, "id" | "image">>(user: T) {
  return { ...user, imageUrl: await resolveUserAvatarUrl(user) }
}

export async function updateOrganizationLogoVersion(organizationId: string) {
  const logo = getImageVersion()

  await db.update(organizationsTable).set({ logo, updatedAt: new Date() }).where(eq(organizationsTable.id, organizationId))

  return logo
}

export async function updateProjectIconVersion(projectId: string) {
  const icon = getImageVersion()

  await db.update(projectsTable).set({ icon, updatedAt: new Date() }).where(eq(projectsTable.id, projectId))

  return icon
}
