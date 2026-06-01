import { createFileRoute } from "@tanstack/react-router"

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

        const redirectUrl = new URL(`/app/${parsedState.orgSlug}/projects/${parsedState.projectSlug}/settings`, requestUrl)

        if (installationId && setupState) {
          redirectUrl.searchParams.set("githubInstallationId", installationId)
          redirectUrl.searchParams.set("githubSetupState", setupState)
        }

        return Response.redirect(redirectUrl, 302)
      },
    },
  },
})
