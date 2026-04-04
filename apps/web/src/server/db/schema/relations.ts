import { defineRelations } from "drizzle-orm"

import * as schema from "."

export const relations = defineRelations(schema, (r) => ({
  usersTable: {
    accounts: r.many.accountsTable(),
    sessions: r.many.sessionsTable(),
    members: r.many.membersTable(),
    invitationsSent: r.many.invitationsTable({ from: r.usersTable.id, to: r.invitationsTable.inviterId }),
  },
  organizationsTable: {
    members: r.many.membersTable(),
    invitations: r.many.invitationsTable(),
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
}))
