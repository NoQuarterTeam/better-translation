import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

import { organizationMiddleware } from "@/lib/functions/middleware"
import { withOrganizationLogoUrl, withUserAvatarUrl } from "@/server/profile-images"

export const currentOrganizationFn = createServerFn({ method: "GET" })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    return {
      user: await withUserAvatarUrl(context.user),
      organization: await withOrganizationLogoUrl(context.organization),
      member: context.member,
    }
  })

export const currentOrganizationQueryOptions = (orgSlug: string) =>
  queryOptions({
    queryKey: ["current-organization", orgSlug],
    queryFn: () => currentOrganizationFn({ data: { orgSlug } }),
    staleTime: 30_000,
  })
