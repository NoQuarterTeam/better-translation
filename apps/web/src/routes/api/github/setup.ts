import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"

import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { organizationsTable } from "@/server/db/schema"
import { readGitHubSetupState } from "@/server/github"
import { upsertOrganizationGitHubInstallation } from "@/server/github-installations"

export const Route = createFileRoute("/api/github/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url)
        const setupState = requestUrl.searchParams.get("state")
        const installationId = requestUrl.searchParams.get("installation_id")
        const parsedState = setupState ? readGitHubSetupState(setupState) : null

        if (!parsedState) return Response.redirect(new URL("/app", requestUrl), 302)

        const redirectPath = parsedState.projectSlug
          ? `/app/${parsedState.orgSlug}/projects/${parsedState.projectSlug}/settings`
          : `/app/${parsedState.orgSlug}/projects/new`
        const redirectUrl = new URL(redirectPath, requestUrl)

        if (installationId) {
          const session = await auth.api.getSession({ headers: request.headers })
          await storeGitHubInstallation({
            connectedByUserId: session?.user.id ?? null,
            installationId,
            orgSlug: parsedState.orgSlug,
          })
        }

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
  connectedByUserId,
  installationId,
  orgSlug,
}: {
  connectedByUserId: string | null
  installationId: string
  orgSlug: string
}) {
  const [organization] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, orgSlug))
    .limit(1)

  if (!organization) return

  await upsertOrganizationGitHubInstallation({
    connectedByUserId,
    installationId,
    organizationId: organization.id,
  })
}
