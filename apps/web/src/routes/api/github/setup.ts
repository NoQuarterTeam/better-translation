import { createFileRoute } from "@tanstack/react-router"

import { findSingleGitHubAppInstallationId, readGitHubSetupState } from "@/server/github"

export const Route = createFileRoute("/api/github/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url)
        const setupState = requestUrl.searchParams.get("state")
        const installationId = requestUrl.searchParams.get("installation_id") ?? (await findSingleGitHubAppInstallationId())
        const parsedState = setupState ? readGitHubSetupState(setupState) : null

        if (!parsedState) return Response.redirect(new URL("/app", requestUrl), 302)

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
