import { createFileRoute, redirect } from "@tanstack/react-router"

import { projectBranchRedirectNameQueryOptions } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug/")({
  loader: async ({ context, params }) => {
    const branchName = await context.queryClient.ensureQueryData(
      projectBranchRedirectNameQueryOptions(params.orgSlug, params.projectSlug),
    )
    if (branchName) {
      throw redirect({
        to: "/app/$orgSlug/$projectSlug/$branchName",
        params: { ...params, branchName },
      })
    }

    throw redirect({
      to: "/app/$orgSlug/$projectSlug/branches",
      params,
    })
  },
})
