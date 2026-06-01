import { createFileRoute } from "@tanstack/react-router"
import { and, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { organizationsTable, projectsTable } from "@/server/db/schema"
import { readGitHubSetupState } from "@/server/github"

export const Route = createFileRoute("/api/github/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url)
        const setupState = requestUrl.searchParams.get("state")
        const installationId = requestUrl.searchParams.get("installation_id")
        const parsedState = setupState ? readGitHubSetupState(setupState) : null

        if (!parsedState) return Response.redirect(new URL("/app", requestUrl), 302)

        if (installationId) {
          await storeGitHubInstallation({
            installationId,
            orgSlug: parsedState.orgSlug,
            projectSlug: parsedState.projectSlug,
          })
        }

        const redirectUrl = new URL(`/app/${parsedState.orgSlug}/projects/${parsedState.projectSlug}/settings`, requestUrl)

        if (setupState) {
          redirectUrl.searchParams.set("githubSetupState", setupState)
        }

        if (installationId) {
          redirectUrl.searchParams.set("githubInstallationId", installationId)
        } else {
          redirectUrl.searchParams.set("githubSetupError", "missing_installation_id")
        }

        return Response.redirect(redirectUrl, 302)
      },
    },
  },
})

async function storeGitHubInstallation({
  installationId,
  orgSlug,
  projectSlug,
}: {
  installationId: string
  orgSlug: string
  projectSlug: string
}) {
  const [organization] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, orgSlug))
    .limit(1)

  if (!organization) return

  await db
    .update(projectsTable)
    .set({ githubInstallationId: installationId, updatedAt: new Date() })
    .where(and(eq(projectsTable.organizationId, organization.id), eq(projectsTable.slug, projectSlug)))
}
