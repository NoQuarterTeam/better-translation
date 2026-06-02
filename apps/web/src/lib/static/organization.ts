import type { OrganizationRole } from "@/lib/auth/permissions"

export type ManageableOrganizationRole = Exclude<OrganizationRole, "owner">

export const ORGANIZATION_ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
} satisfies Record<OrganizationRole, string>

export function getOrganizationRoleLabel(role: string) {
  return ORGANIZATION_ROLE_LABELS[role as OrganizationRole] ?? role
}

export const MANAGEABLE_ORGANIZATION_ROLES = [
  "admin",
  "editor",
  "viewer",
] as const satisfies readonly ManageableOrganizationRole[]

export const MANAGEABLE_ORGANIZATION_ROLE_OPTIONS = MANAGEABLE_ORGANIZATION_ROLES.map((value) => ({
  value,
  label: getOrganizationRoleLabel(value),
}))

export const ORGANIZATION_ROLE_DESCRIPTIONS = {
  owner: "Full control of the organization, including ownership transfer and member management.",
  admin: "Can manage members, invitations, Projects, and organization settings.",
  editor: "Can work with Projects and translation content, but cannot manage organization users.",
  viewer: "Can view organization content, but cannot manage users or make changes.",
} satisfies Record<OrganizationRole, string>

export function getOrganizationRoleDescription(role: string) {
  return ORGANIZATION_ROLE_DESCRIPTIONS[role as OrganizationRole] ?? ""
}
