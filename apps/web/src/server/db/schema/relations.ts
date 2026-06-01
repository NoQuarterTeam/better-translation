import { defineRelations } from "drizzle-orm"

import * as schema from "."

export const relations = defineRelations(schema, (r) => ({
  usersTable: {
    accounts: r.many.accountsTable(),
    sessions: r.many.sessionsTable(),
    members: r.many.membersTable(),
    invitationsSent: r.many.invitationsTable({ from: r.usersTable.id, to: r.invitationsTable.inviterId }),
    apiKeys: r.many.apiKeysTable(),
    localeValues: r.many.localeValuesTable(),
  },
  organizationsTable: {
    members: r.many.membersTable(),
    invitations: r.many.invitationsTable(),
    projects: r.many.projectsTable(),
    githubInstallations: r.many.organizationGithubInstallationsTable(),
  },
  membersTable: {
    user: r.one.usersTable({ from: r.membersTable.userId, to: r.usersTable.id }),
    organization: r.one.organizationsTable({ from: r.membersTable.organizationId, to: r.organizationsTable.id }),
  },
  invitationsTable: {
    organization: r.one.organizationsTable({ from: r.invitationsTable.organizationId, to: r.organizationsTable.id }),
    inviter: r.one.usersTable({ from: r.invitationsTable.inviterId, to: r.usersTable.id }),
  },
  sessionsTable: {
    user: r.one.usersTable({ from: r.sessionsTable.userId, to: r.usersTable.id }),
    activeOrganization: r.one.organizationsTable({
      from: r.sessionsTable.activeOrganizationId,
      to: r.organizationsTable.id,
      optional: true,
    }),
  },
  accountsTable: { user: r.one.usersTable({ from: r.accountsTable.userId, to: r.usersTable.id }) },
  githubInstallationsTable: {
    connectedBy: r.one.usersTable({
      from: r.githubInstallationsTable.connectedByUserId,
      to: r.usersTable.id,
      optional: true,
    }),
    organizations: r.many.organizationGithubInstallationsTable(),
  },
  organizationGithubInstallationsTable: {
    organization: r.one.organizationsTable({
      from: r.organizationGithubInstallationsTable.organizationId,
      to: r.organizationsTable.id,
    }),
    githubInstallation: r.one.githubInstallationsTable({
      from: r.organizationGithubInstallationsTable.githubInstallationId,
      to: r.githubInstallationsTable.id,
    }),
  },
  projectsTable: {
    organization: r.one.organizationsTable({ from: r.projectsTable.organizationId, to: r.organizationsTable.id }),
    defaultBranch: r.one.branchesTable({
      from: r.projectsTable.defaultBranchId,
      to: r.branchesTable.id,
      optional: true,
    }),
    branches: r.many.branchesTable(),
    messages: r.many.messagesTable(),
    apiKeys: r.many.apiKeysTable(),
    localeValues: r.many.localeValuesTable(),
  },
  branchesTable: {
    project: r.one.projectsTable({ from: r.branchesTable.projectId, to: r.projectsTable.id }),
    messages: r.many.messagesTable(),
    localeValues: r.many.localeValuesTable(),
  },
  messagesTable: {
    project: r.one.projectsTable({ from: r.messagesTable.projectId, to: r.projectsTable.id }),
    branch: r.one.branchesTable({ from: r.messagesTable.branchId, to: r.branchesTable.id }),
    localeValues: r.many.localeValuesTable(),
  },
  localeValuesTable: {
    project: r.one.projectsTable({ from: r.localeValuesTable.projectId, to: r.projectsTable.id }),
    branch: r.one.branchesTable({ from: r.localeValuesTable.branchId, to: r.branchesTable.id }),
    message: r.one.messagesTable({ from: r.localeValuesTable.messageId, to: r.messagesTable.id }),
    updatedBy: r.one.usersTable({
      from: r.localeValuesTable.updatedById,
      to: r.usersTable.id,
      optional: true,
    }),
  },
  apiKeysTable: {
    project: r.one.projectsTable({ from: r.apiKeysTable.projectId, to: r.projectsTable.id }),
    createdBy: r.one.usersTable({ from: r.apiKeysTable.createdById, to: r.usersTable.id, optional: true }),
  },
}))
