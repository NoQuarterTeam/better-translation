import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { BoxesIcon, GitBranchIcon, KeyRoundIcon, LanguagesIcon } from "lucide-react"

import { T } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { getOrganizationOverviewFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_org/")({
  component: OrganizationPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(organizationOverviewQueryOptions(params.orgSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Organization")} · Better Translation` }] }
  },
})

const organizationOverviewQueryOptions = (orgSlug: string) => ({
  queryKey: ["organization-overview", orgSlug],
  queryFn: () => getOrganizationOverviewFn({ data: { orgSlug } }),
})

function OrganizationPage() {
  const { orgSlug } = Route.useParams()
  const overviewQuery = useQuery(organizationOverviewQueryOptions(orgSlug))
  const stats = [
    { label: "Projects", value: overviewQuery.data?.projectCount ?? 0, icon: BoxesIcon },
    { label: "Branches", value: overviewQuery.data?.branchCount ?? 0, icon: GitBranchIcon },
    { label: "Messages", value: overviewQuery.data?.messageCount ?? 0, icon: LanguagesIcon },
    { label: "Active API keys", value: overviewQuery.data?.activeApiKeyCount ?? 0, icon: KeyRoundIcon },
  ] as const

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {overviewQuery.data?.organization.name ?? <T>Organization</T>}
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Hosted translation platform activity for this organization.</T>
          </p>
        </div>
        <Link to="/app/$orgSlug/projects/new" params={{ orgSlug }} className={cn(buttonVariants(), "w-fit")}>
          <T>Create Project</T>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-3xl">{value.toLocaleString()}</CardTitle>
              </div>
              <Icon className="text-muted-foreground" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Recent Projects</T>
          </CardTitle>
          <CardDescription>
            <T>Jump back into a Project to edit Translation Branches, Locale values, and API keys.</T>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(overviewQuery.data?.recentProjects ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <T>No Projects yet.</T>
            </div>
          ) : (
            overviewQuery.data?.recentProjects.map((project) => (
              <Link
                key={project.id}
                to="/app/$orgSlug/projects/$projectId"
                params={{ orgSlug, projectId: project.publicId }}
                className="flex flex-col gap-3 rounded-md border p-4 no-underline transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{project.publicId}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{project.defaultLocale}</Badge>
                  <Badge variant="secondary">
                    {project.locales.length.toLocaleString()} <T>Locales</T>
                  </Badge>
                  <Badge variant="secondary">
                    {project.overrideCount.toLocaleString()} <T>Overrides</T>
                  </Badge>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
