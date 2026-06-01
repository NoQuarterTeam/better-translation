import { and, asc, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { githubInstallationsTable, organizationGithubInstallationsTable } from "@/server/db/schema"
import { getGitHubAppInstallation } from "@/server/github"

export async function upsertOrganizationGitHubInstallation({
  connectedByUserId,
  installationId,
  organizationId,
}: {
  connectedByUserId: string | null
  installationId: string
  organizationId: string
}) {
  const installation = await getGitHubAppInstallation(installationId)
  return db.transaction(async (tx) => {
    const [githubInstallation] = await tx
      .insert(githubInstallationsTable)
      .values({
        accountAvatarUrl: installation.accountAvatarUrl,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        connectedByUserId,
        installationId: installation.installationId,
        repositorySelection: installation.repositorySelection,
      })
      .onConflictDoUpdate({
        target: githubInstallationsTable.installationId,
        set: {
          accountAvatarUrl: installation.accountAvatarUrl,
          accountLogin: installation.accountLogin,
          accountType: installation.accountType,
          connectedByUserId,
          repositorySelection: installation.repositorySelection,
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!githubInstallation) throw new Error("Could not save GitHub installation.")

    await tx
      .insert(organizationGithubInstallationsTable)
      .values({ githubInstallationId: githubInstallation.id, organizationId })
      .onConflictDoUpdate({
        target: [organizationGithubInstallationsTable.organizationId, organizationGithubInstallationsTable.githubInstallationId],
        set: { updatedAt: new Date() },
      })

    return githubInstallation
  })
}

export async function listOrganizationGitHubInstallations(organizationId: string) {
  return db
    .select({
      accountAvatarUrl: githubInstallationsTable.accountAvatarUrl,
      accountLogin: githubInstallationsTable.accountLogin,
      accountType: githubInstallationsTable.accountType,
      id: githubInstallationsTable.id,
      installationId: githubInstallationsTable.installationId,
      repositorySelection: githubInstallationsTable.repositorySelection,
    })
    .from(organizationGithubInstallationsTable)
    .innerJoin(
      githubInstallationsTable,
      eq(githubInstallationsTable.id, organizationGithubInstallationsTable.githubInstallationId),
    )
    .where(eq(organizationGithubInstallationsTable.organizationId, organizationId))
    .orderBy(asc(githubInstallationsTable.accountLogin))
}

export async function organizationCanUseGitHubInstallation({
  installationId,
  organizationId,
}: {
  installationId: string
  organizationId: string
}) {
  const [installation] = await db
    .select({ id: githubInstallationsTable.id })
    .from(organizationGithubInstallationsTable)
    .innerJoin(
      githubInstallationsTable,
      eq(githubInstallationsTable.id, organizationGithubInstallationsTable.githubInstallationId),
    )
    .where(
      and(
        eq(organizationGithubInstallationsTable.organizationId, organizationId),
        eq(githubInstallationsTable.installationId, installationId),
      ),
    )
    .limit(1)

  return Boolean(installation)
}
