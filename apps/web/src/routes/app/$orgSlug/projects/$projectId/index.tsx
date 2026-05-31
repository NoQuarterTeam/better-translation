import { createFileRoute, redirect } from "@tanstack/react-router"

import { projectBranchRedirectNameQueryOptions } from "./index/-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectId/")({
  loader: async ({ context, params }) => {
    const branchName = await context.queryClient.ensureQueryData(
      projectBranchRedirectNameQueryOptions(params.orgSlug, params.projectId),
    )
    if (branchName) {
      throw redirect({
        to: "/app/$orgSlug/projects/$projectId/branches/$branchName",
        params: { ...params, branchName },
      })
    }

    throw redirect({
      to: "/app/$orgSlug/projects/$projectId/branches",
      params,
    })
  },
})
