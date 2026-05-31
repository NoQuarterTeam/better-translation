import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { BoxesIcon, GitBranchIcon, KeyRoundIcon, LanguagesIcon } from "lucide-react"

import { T } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { organizationOverviewQueryOptions } from "./-data"

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

function OrganizationPage() {
  const { orgSlug } = Route.useParams()
  const overview = useSuspenseQuery(organizationOverviewQueryOptions(orgSlug)).data
  const stats = [
    { label: "Projects", value: overview.projectCount, icon: BoxesIcon },
    { label: "Branches", value: overview.branchCount, icon: GitBranchIcon },
    { label: "Messages", value: overview.messageCount, icon: LanguagesIcon },
    { label: "Active API keys", value: overview.activeApiKeyCount, icon: KeyRoundIcon },
  ] as const

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{overview.organization.name}</h1>
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
            <T>Jump back into a Project to edit Branches, Locale values, and API keys.</T>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {overview.recentProjects.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <T>No Projects yet.</T>
            </div>
          ) : (
            overview.recentProjects.map((project) => (
              <Link
                key={project.id}
                to="/app/$orgSlug/projects/$projectSlug"
                params={{ orgSlug, projectSlug: project.slug }}
                className="flex flex-col gap-3 rounded-md border p-4 no-underline transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{project.slug}</div>
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
