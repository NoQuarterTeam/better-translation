import { createFileRoute, redirect } from "@tanstack/react-router"

import { getProjectLandingBranchFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectId/")({
  beforeLoad: async ({ params }) => {
    const branchName = await getProjectLandingBranchFn({ data: params })
    throw redirect({
      to: "/app/$orgSlug/projects/$projectId/branches/$branchName",
      params: { ...params, branchName },
    })
  },
})
