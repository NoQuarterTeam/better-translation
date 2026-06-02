import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements, ownerAc } from "better-auth/plugins/organization/access"

export const organizationStatements = defaultStatements

export type OrganizationStatements = typeof organizationStatements

export const organizationAc = createAccessControl(organizationStatements)

export type OrganizationResource = keyof OrganizationStatements

type OrganizationRolePermissions = {
  [Resource in OrganizationResource]: readonly OrganizationStatements[Resource][number][]
}

export const organizationRolePermissions = {
  owner: ownerAc.statements,
  admin: adminAc.statements,
  editor: {
    organization: [],
    member: [],
    invitation: [],
    team: [],
    ac: [],
  },
  viewer: {
    organization: [],
    member: [],
    invitation: [],
    team: [],
    ac: [],
  },
} as const satisfies Record<string, OrganizationRolePermissions>

export type OrganizationRole = keyof typeof organizationRolePermissions

export const organizationRoles = {
  owner: organizationAc.newRole(organizationRolePermissions.owner),
  admin: organizationAc.newRole(organizationRolePermissions.admin),
  editor: organizationAc.newRole(organizationRolePermissions.editor),
  viewer: organizationAc.newRole(organizationRolePermissions.viewer),
} as const

export function hasOrganizationPermission(
  role: OrganizationRole,
  resource: OrganizationResource,
  action: OrganizationStatements[typeof resource][number],
) {
  return organizationRolePermissions[role][resource].some((allowedAction) => allowedAction === action)
}

export type OrganizationPermissionMap = {
  [Resource in OrganizationResource]?: readonly OrganizationStatements[Resource][number][]
}

export type OrganizationAccessOptions = {
  roles?: readonly OrganizationRole[]
  permissions?: OrganizationPermissionMap
}

export function hasOrganizationAccess(role: OrganizationRole, { roles, permissions }: OrganizationAccessOptions = {}) {
  if (roles?.length && !roles.some((allowedRole) => allowedRole === role)) return false
  if (!permissions) return true

  return Object.entries(permissions).every(([resource, actions]) =>
    (actions ?? []).every((action) => hasOrganizationPermission(role, resource as OrganizationResource, action)),
  )
}
