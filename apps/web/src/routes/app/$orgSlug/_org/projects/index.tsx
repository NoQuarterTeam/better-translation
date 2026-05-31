import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpRightIcon, BoxesIcon, GitBranchIcon, LanguagesIcon, PlusIcon } from "lucide-react"
import { useMemo } from "react"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { projectsQueryOptions, type listProjectsFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_org/projects/")({
  component: ProjectsPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectsQueryOptions(params.orgSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Projects")} · Better Translation` }] }
  },
})

type ProjectRow = Awaited<ReturnType<typeof listProjectsFn>>[number]

function ProjectsPage() {
  const { orgSlug } = Route.useParams()
  const t = useT()
  const projects = useSuspenseQuery(projectsQueryOptions(orgSlug)).data

  const columns = useMemo<ColumnDef<ProjectRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("Project"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to="/app/$orgSlug/projects/$projectSlug"
              params={{ orgSlug, projectSlug: row.original.slug }}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.original.name}
            </Link>
            <div className="mt-1 text-xs text-muted-foreground">{row.original.slug}</div>
          </div>
        ),
      },
      {
        accessorKey: "defaultLocale",
        header: t("Locales"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            {row.original.locales.map((locale) => (
              <Badge key={locale} variant={locale === row.original.defaultLocale ? "default" : "secondary"}>
                {locale}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "branchCount",
        header: t("Branches"),
        cell: ({ row }) => row.original.branchCount.toLocaleString(),
      },
      {
        accessorKey: "messageCount",
        header: t("Messages"),
        cell: ({ row }) => row.original.messageCount.toLocaleString(),
      },
      {
        id: "open",
        header: "",
        cell: ({ row }) => (
          <Link
            to="/app/$orgSlug/projects/$projectSlug"
            params={{ orgSlug, projectSlug: row.original.slug }}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "ml-auto")}
            aria-label={t("Open Project")}
          >
            <ArrowUpRightIcon />
          </Link>
        ),
      },
    ],
    [orgSlug, t],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Projects</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Manage hosted Projects, Branches, Runtime bundles, and plugin credentials.</T>
          </p>
        </div>
        <Link to="/app/$orgSlug/projects/new" params={{ orgSlug }} className={cn(buttonVariants(), "w-fit")}>
          <PlusIcon />
          <T>New Project</T>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardDescription>
                <T>Projects</T>
              </CardDescription>
              <CardTitle className="text-3xl">{projects.length}</CardTitle>
            </div>
            <BoxesIcon className="text-muted-foreground" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardDescription>
                <T>Branches</T>
              </CardDescription>
              <CardTitle className="text-3xl">{projects.reduce((total, project) => total + project.branchCount, 0)}</CardTitle>
            </div>
            <GitBranchIcon className="text-muted-foreground" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardDescription>
                <T>Messages</T>
              </CardDescription>
              <CardTitle className="text-3xl">{projects.reduce((total, project) => total + project.messageCount, 0)}</CardTitle>
            </div>
            <LanguagesIcon className="text-muted-foreground" />
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            <T>Project list</T>
          </CardTitle>
          <CardDescription>
            <T>Each Project maps to one Consumer app using the Better Translation Vite plugin.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={projects} />
        </CardContent>
      </Card>
    </div>
  )
}
