import { Badge } from "@better-translation/ui/components/badge"
import { Button, buttonVariants } from "@better-translation/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@better-translation/ui/components/tooltip"
import { cn } from "@better-translation/ui/lib/utils"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRightIcon, CloudCheck, PlusIcon } from "lucide-react"

import { T, useT } from "better-translation/react"
import { createT } from "better-translation/runtime"

import { ResourceMark } from "@/components/resource-mark"
import { formatLocale } from "@/lib/locales"

import { projectsQueryOptions, type listProjectsFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_org/")({
  component: ProjectsPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectsQueryOptions(params.orgSlug))
  },
  head: ({ match }) => {
    const t = createT(match.context.messages)
    return { meta: [{ title: `${t("Projects")} · Better Translation` }] }
  },
})

type ProjectListItem = Awaited<ReturnType<typeof listProjectsFn>>[number]

function ProjectsPage() {
  const { orgSlug } = Route.useParams()
  const { locale: appLocale } = Route.useRouteContext()
  const projects = useSuspenseQuery(projectsQueryOptions(orgSlug)).data

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
        <Link to="/app/$orgSlug/new" params={{ orgSlug }} className={cn(buttonVariants(), "w-fit")}>
          <PlusIcon />
          <T>New Project</T>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-lg border border-dashed text-center">
          <div>
            <h2 className="font-medium">
              <T>No Projects</T>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <T>Create a Project to sync Messages from a Consumer app.</T>
            </p>
          </div>
          <Link to="/app/$orgSlug/new" params={{ orgSlug }} className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
            <PlusIcon />
            <T>New Project</T>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} appLocale={appLocale} orgSlug={orgSlug} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ appLocale, orgSlug, project }: { appLocale: string; orgSlug: string; project: ProjectListItem }) {
  const t = useT()
  const lastSyncedAt = project.lastSyncedAt
  const isSetup = !lastSyncedAt

  return (
    <div
      className={cn(
        "group/project-card relative flex h-full flex-col justify-between gap-3 overflow-hidden rounded-lg border border-border p-4 text-sm transition-colors hover:border-foreground/20 hover:bg-muted/40",
        isSetup && "border-dashed bg-muted/20 opacity-90",
      )}
    >
      <Link
        to="/app/$orgSlug/$projectSlug"
        params={{ orgSlug, projectSlug: project.slug }}
        aria-label={t("Open {projectName}", { projectName: project.name })}
        className="absolute inset-0 z-10 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="pointer-events-none relative z-20 flex min-w-0 items-start gap-3 pr-8">
        <ResourceMark label={project.name} imageUrl={project.iconUrl} className="size-10 rounded-md" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="line-clamp-1 max-w-full text-base leading-snug font-semibold">{project.name}</div>
          <ProjectRepositoryLabel project={project} />
        </div>
      </div>

      {!isSetup && <ProjectSyncTooltip appLocale={appLocale} lastSyncedAt={lastSyncedAt} />}

      <div className="pointer-events-none relative z-20 flex min-h-8 flex-wrap items-center justify-between gap-2">
        {isSetup ? (
          <>
            <p className="min-w-0 text-sm text-muted-foreground">
              <T>Not synced yet</T>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="pointer-events-auto w-fit"
              nativeButton={false}
              render={<Link to="/app/$orgSlug/$projectSlug/api-keys" params={{ orgSlug, projectSlug: project.slug }} />}
            >
              <T>Install plugin</T>
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">{formatMessageSummary(project.messageCount, appLocale, t)}</span>

            <ProjectLocaleBadges appLocale={appLocale} locales={project.locales} />
          </>
        )}
      </div>
    </div>
  )
}

function ProjectRepositoryLabel({ project }: { project: ProjectListItem }) {
  const repository = formatProjectRepository(project)

  if (!repository) {
    return (
      <p className="truncate text-xs text-muted-foreground">
        <T>No repository connected</T>
      </p>
    )
  }

  return (
    <span className="inline-flex h-5 w-fit max-w-full items-center gap-1.5 rounded-full border border-border px-1.5 text-xs">
      <GitHubLogoIcon />
      <span className="min-w-0 truncate">{repository}</span>
    </span>
  )
}

function ProjectSyncTooltip({ appLocale, lastSyncedAt }: { appLocale: string; lastSyncedAt: Date | string }) {
  const t = useT()

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="pointer-events-auto absolute top-4 right-4 z-30 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" />
        }
      >
        <CloudCheck className="size-3.5" />
        <span className="sr-only">
          <T>Synced</T>
        </span>
      </TooltipTrigger>
      <TooltipContent align="end">{t("Synced {date}", { date: formatSyncedDateTime(lastSyncedAt, appLocale) })}</TooltipContent>
    </Tooltip>
  )
}

function ProjectLocaleBadges({ appLocale, locales }: { appLocale: string; locales: string[] }) {
  const t = useT()
  if (locales.length === 0) return <span className="text-xs text-muted-foreground">{t("No locales")}</span>

  const visibleLocales = locales.slice(0, 3)
  const extraCount = locales.length - visibleLocales.length
  const localeNames = locales.map((locale) => formatLocale(locale, [appLocale]))

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {visibleLocales.map((locale) => (
        <Badge
          key={locale}
          variant="secondary"
          title={formatLocale(locale, [appLocale])}
          className="h-5 max-w-24 px-2 text-xs font-medium"
        >
          <span className="truncate">{formatLocale(locale, [appLocale])}</span>
        </Badge>
      ))}
      {extraCount > 0 && (
        <Tooltip>
          <TooltipTrigger render={<span className="pointer-events-auto relative z-30 inline-flex rounded-full outline-none" />}>
            <Badge variant="outline" className="h-5 px-2 text-xs font-medium">
              +{extraCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent align="end">{localeNames.join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}

function formatProjectRepository(project: Pick<ProjectListItem, "githubRepositoryName" | "githubRepositoryOwner">) {
  return project.githubRepositoryOwner && project.githubRepositoryName
    ? `${project.githubRepositoryOwner}/${project.githubRepositoryName}`
    : null
}

function GitHubLogoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="size-3 shrink-0">
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.95c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.92v2.79c0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  )
}

function formatMessageSummary(count: number, appLocale: string, t: ReturnType<typeof useT>) {
  if (count === 0) return t("No messages yet")

  return formatCount(count, appLocale, t("message"), t("messages"))
}

function formatCount(count: number, appLocale: string, singularLabel: string, pluralLabel: string) {
  return `${count.toLocaleString(appLocale)} ${count === 1 ? singularLabel : pluralLabel}`
}

function formatSyncedDateTime(lastSyncedAt: Date | string, appLocale: string) {
  return new Intl.DateTimeFormat(appLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(lastSyncedAt))
}
