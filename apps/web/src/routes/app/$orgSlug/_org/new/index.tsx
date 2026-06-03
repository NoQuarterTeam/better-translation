import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { FieldError } from "@better-translation/ui/components/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@better-translation/ui/components/input-group"
import { Skeleton } from "@better-translation/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@better-translation/ui/components/tabs"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { GitBranchIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"

import { GitHubAccountSelect } from "../../-components/github-account-select"
import { projectSwitcherProjectsQueryOptions } from "../../_projects/$projectSlug/-data"
import {
  createProjectFn,
  createProjectFromGitHubRepositoryFn,
  newProjectGitHubRepositoriesQueryOptions,
  newProjectGitHubSetupQueryOptions,
} from "./-data"

const githubInstallationIdSearchSchema = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined)

export const Route = createFileRoute("/app/$orgSlug/_org/new/")({
  component: NewProjectPage,
  validateSearch: z
    .object({
      githubInstallationId: githubInstallationIdSearchSchema,
      githubSetupError: z.enum(["missing_installation_id"]).optional().catch(undefined),
      githubSetupState: z.string().optional().catch(undefined),
      installation_id: githubInstallationIdSearchSchema,
      state: z.string().optional().catch(undefined),
    })
    .transform((search) => ({
      githubInstallationId: search.githubInstallationId ?? search.installation_id,
      githubSetupError: search.githubSetupError,
      githubSetupState: search.githubSetupState ?? search.state,
    })),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(newProjectGitHubSetupQueryOptions(params.orgSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("New Project")} · Better Translation` }] }
  },
})

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function NewProjectPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New Project</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Create a Project from a GitHub repository or configure it manually.</T>
        </p>
      </div>
      <Tabs defaultValue="github">
        <TabsList>
          <TabsTrigger value="github">
            <GitBranchIcon />
            <T>Connect repository</T>
          </TabsTrigger>
          <TabsTrigger value="manual">
            <PlusIcon />
            <T>Create manually</T>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="github">
          <GitHubImportCard />
        </TabsContent>
        <TabsContent value="manual">
          <ManualProjectCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GitHubImportCard() {
  const { orgSlug } = Route.useParams()
  const search = Route.useSearch()
  const { queryClient } = Route.useRouteContext()
  const navigate = useNavigate()
  const t = useT()
  const setupQuery = useSuspenseQuery(newProjectGitHubSetupQueryOptions(orgSlug))
  const setup = setupQuery.data
  const isLoadingGitHubAccounts = setupQuery.isFetching && setup.githubInstallations.length === 0
  const [selectedInstallationId, setSelectedInstallationId] = useState(search.githubInstallationId ?? "")
  const activeInstallationId = selectedInstallationId || setup.githubInstallations[0]?.installationId || ""
  const [repositoryPage, setRepositoryPage] = useState(1)
  const [repositorySearch, setRepositorySearch] = useState("")
  const repositoriesQuery = useQuery(
    newProjectGitHubRepositoriesQueryOptions({
      installationId: activeInstallationId,
      orgSlug,
      page: repositoryPage,
      search: repositorySearch,
    }),
  )
  const repositories = repositoriesQuery.data?.repositories ?? []
  const showPaginationSkeleton = isLoadingGitHubAccounts || (Boolean(activeInstallationId) && repositoriesQuery.isLoading)
  const showPagination =
    repositoriesQuery.data && (repositoriesQuery.data.page > 1 || repositoriesQuery.data.hasMore) && !showPaginationSkeleton

  const createFromRepository = useMutation({
    mutationFn: createProjectFromGitHubRepositoryFn,
    onSuccess: (project) => {
      toast.success(t("Project imported"))
      void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
      void navigate({ to: "/app/$orgSlug/$projectSlug", params: { orgSlug, projectSlug: project.slug } })
    },
    onError: (error: Error) => toast.error(t("Could not import repository"), { description: error.message }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Import GitHub repository</T>
        </CardTitle>
        <CardDescription>
          <T>Create a Project from a repository and use its default branch as the Production Branch.</T>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoadingGitHubAccounts ? (
          <GitHubImportToolbarSkeleton />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GitHubAccountSelect
              className="flex gap-2"
              githubInstallUrl={setup.githubInstallUrl}
              installations={setup.githubInstallations}
              onAddAccountComplete={() => void setupQuery.refetch()}
              onSelectInstallation={(installationId) => {
                setSelectedInstallationId(installationId)
                setRepositoryPage(1)
              }}
              selectedInstallationId={activeInstallationId}
            />
            <div>
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder={t("Search repositories...")}
                  value={repositorySearch}
                  onChange={(event) => {
                    setRepositorySearch(event.target.value)
                    setRepositoryPage(1)
                  }}
                />
              </InputGroup>
            </div>
          </div>
        )}

        {githubSetupErrorMessage(search.githubSetupError)}

        {isLoadingGitHubAccounts ? (
          <GitHubRepositoryListSkeleton />
        ) : (
          <div className="overflow-hidden rounded-md border">
            {setup.githubInstallations.length === 0 ? (
              <div className="flex flex-col gap-3 p-6 text-center">
                <GitBranchIcon className="mx-auto text-muted-foreground" />
                <div className="font-medium">
                  <T>No GitHub accounts connected</T>
                </div>
                <p className="text-sm text-muted-foreground">
                  <T>Add a GitHub account to import a repository into this organization.</T>
                </p>
              </div>
            ) : repositoriesQuery.isLoading ? (
              <GitHubRepositoryRowsSkeleton />
            ) : repositories.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <T>No repositories found.</T>
              </div>
            ) : (
              repositories.map((repository) => (
                <div
                  key={repository.id}
                  className="flex flex-col gap-3 border-b p-4 last:border-b-0 sm:h-20 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{repository.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                      <span>{repository.owner}</span>
                      <span>/</span>
                      <span>{repository.defaultBranch}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={createFromRepository.isPending}
                    onClick={() =>
                      createFromRepository.mutate({
                        data: {
                          installationId: activeInstallationId,
                          name: repository.name,
                          orgSlug,
                          repositoryId: repository.id,
                          repositoryName: repository.name,
                          repositoryOwner: repository.owner,
                          slug: slugify(repository.name),
                        },
                      })
                    }
                  >
                    <T>Import</T>
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
        {showPaginationSkeleton ? (
          <GitHubRepositoryPaginationSkeleton />
        ) : showPagination ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={repositoriesQuery.data.page <= 1 || repositoriesQuery.isFetching}
              onClick={() => setRepositoryPage((page) => Math.max(1, page - 1))}
            >
              <T>Previous</T>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!repositoriesQuery.data.hasMore || repositoriesQuery.isFetching}
              onClick={() => setRepositoryPage((page) => page + 1)}
            >
              <T>Next</T>
            </Button>
          </div>
        ) : null}
        <FieldError>{repositoriesQuery.error?.message ?? createFromRepository.error?.message}</FieldError>
      </CardContent>
    </Card>
  )
}

function GitHubImportToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-9 w-64 max-w-full" />
    </div>
  )
}

function GitHubRepositoryListSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border">
      <GitHubRepositoryRowsSkeleton />
    </div>
  )
}

function GitHubRepositoryRowsSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 border-b p-4 last:border-b-0 sm:h-20">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-28 max-w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </>
  )
}

function GitHubRepositoryPaginationSkeleton() {
  return (
    <div className="flex items-center justify-end gap-2">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-16" />
    </div>
  )
}

function ManualProjectCard() {
  const { orgSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const navigate = useNavigate()
  const [hasEditedSlug, setHasEditedSlug] = useState(false)

  const createMutation = useMutation({
    mutationFn: createProjectFn,
    onSuccess: (project) => {
      toast.success(t("Project created"))
      void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
      void navigate({ to: "/app/$orgSlug/$projectSlug", params: { orgSlug, projectSlug: project.slug } })
    },
  })

  const form = useAppForm({
    defaultValues: {
      defaultBranchName: "",
      name: "",
      slug: "",
    },
    validators: {
      onSubmit: z.object({
        defaultBranchName: z.string().trim(),
        name: z
          .string()
          .trim()
          .min(1, { error: t("Project name is required") })
          .max(120),
        slug: z.string().trim(),
      }),
    },
    onSubmit: ({ value }) => {
      const defaultBranchName = value.defaultBranchName.trim()
      createMutation.mutate({
        data: {
          defaultBranchName: defaultBranchName || undefined,
          name: value.name,
          orgSlug,
          slug: value.slug.trim() || slugify(value.name),
        },
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Project details</T>
        </CardTitle>
        <CardDescription>
          <T>Create a Project without connecting a GitHub repository.</T>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  label={t("Project name")}
                  placeholder="Acme Web"
                  onChange={(e) => {
                    const value = e.target.value
                    field.handleChange(value)
                    if (!hasEditedSlug) {
                      form.setFieldValue("slug", slugify(value))
                    }
                  }}
                />
              )}
            </form.AppField>
            <form.AppField name="slug">
              {(field) => (
                <field.TextField
                  label={t("URL slug")}
                  placeholder="acme-web"
                  description={t("Lowercase, hyphens only. Used in URLs and must be unique.")}
                  onChange={(e) => {
                    setHasEditedSlug(true)
                    field.handleChange(e.target.value)
                  }}
                />
              )}
            </form.AppField>
            <form.AppField name="defaultBranchName">
              {(field) => (
                <field.TextField
                  label={t("Production Branch")}
                  placeholder="main"
                  description={t("Optional. If omitted, the first Vite plugin sync sets the Production Branch.")}
                />
              )}
            </form.AppField>
            <form.SubmitButton className="w-full">
              {(isSubmitting) => (isSubmitting || createMutation.isPending ? <T>Creating...</T> : <T>Create Project</T>)}
            </form.SubmitButton>
            <form.FormError>{createMutation.error?.message}</form.FormError>
          </form>
        </form.AppForm>
      </CardContent>
    </Card>
  )
}

function githubSetupErrorMessage(error?: "missing_installation_id") {
  if (!error) return null
  return (
    <FieldError>
      <T>
        GitHub returned without an installation id. Check that the GitHub App Setup URL points to /api/github/setup, then start
        the connection again.
      </T>
    </FieldError>
  )
}
