import { createFileRoute, redirect } from "@tanstack/react-router"

import { projectBranchRedirectNameQueryOptions } from "./index/-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectSlug/")({
  loader: async ({ context, params }) => {
    const branchName = await context.queryClient.ensureQueryData(
      projectBranchRedirectNameQueryOptions(params.orgSlug, params.projectSlug),
    )
    if (branchName) {
      throw redirect({
        to: "/app/$orgSlug/projects/$projectSlug/branches/$branchName",
        params: { ...params, branchName },
      })
    }

    throw redirect({
      to: "/app/$orgSlug/projects/$projectSlug/branches",
      params,
    })
  },
})
