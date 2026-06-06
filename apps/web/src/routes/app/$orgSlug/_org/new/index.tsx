import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { FieldError } from "@better-translation/ui/components/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@better-translation/ui/components/input-group"
import { NativeSelectOption } from "@better-translation/ui/components/native-select"
import { Skeleton } from "@better-translation/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@better-translation/ui/components/tabs"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, GitBranchIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createT } from "better-translation/runtime"

import { useAppForm } from "@/components/react-form"

import { GitHubAccountSelect } from "../../-components/github-account-select"
import { projectSwitcherProjectsQueryOptions } from "../../_projects/$projectSlug/-data"
import {
  createProjectFn,
  createProjectFromGitHubRepositoryFn,
  newProjectGitHubBranchesQueryOptions,
  newProjectGitHubRepositoriesQueryOptions,
  newProjectGitHubSetupQueryOptions,
  suggestedProjectSlugQueryOptions,
} from "./-data"

const githubInstallationIdSearchSchema = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined)

type GitHubRepository = {
  defaultBranch: string
  fullName: string
  id: string
  name: string
  owner: string
}

type GitHubImportStep = { type: "list" } | { type: "configure"; installationId: string; repository: GitHubRepository }

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
    const t = createT(match.context.messages)
    return { meta: [{ title: `${t("New Project")} · Better Translation` }] }
  },
})

function slugify(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "")

  return slug || "project"
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
  const t = useT()
  const setupQuery = useSuspenseQuery(newProjectGitHubSetupQueryOptions(orgSlug))
  const setup = setupQuery.data
  const isLoadingGitHubAccounts = setupQuery.isFetching && setup.githubInstallations.length === 0
  const [selectedInstallationId, setSelectedInstallationId] = useState(search.githubInstallationId ?? "")
  const activeInstallationId = selectedInstallationId || setup.githubInstallations[0]?.installationId || ""
  const [repositoryPage, setRepositoryPage] = useState(1)
  const [repositorySearch, setRepositorySearch] = useState("")
  const [step, setStep] = useState<GitHubImportStep>({ type: "list" })
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

  if (step.type === "configure") {
    return (
      <GitHubRepositoryConfigureCard
        installationId={step.installationId}
        repository={step.repository}
        onBack={() => setStep({ type: "list" })}
      />
    )
  }

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
                    onClick={() => setStep({ type: "configure", installationId: activeInstallationId, repository })}
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
        <FieldError>{repositoriesQuery.error?.message}</FieldError>
      </CardContent>
    </Card>
  )
}

function GitHubRepositoryConfigureCard({
  installationId,
  repository,
  onBack,
}: {
  installationId: string
  repository: GitHubRepository
  onBack: () => void
}) {
  const { orgSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const navigate = useNavigate()
  const [hasEditedSlug, setHasEditedSlug] = useState(false)
  const suggestedSlugQuery = useQuery(suggestedProjectSlugQueryOptions(orgSlug, slugify(repository.name)))
  const branchesQuery = useQuery(newProjectGitHubBranchesQueryOptions({ installationId, orgSlug, repository }))
  const branches = [...new Set([repository.defaultBranch, ...(branchesQuery.data ?? [])])]

  const createFromRepository = useMutation({
    mutationFn: createProjectFromGitHubRepositoryFn,
    onSuccess: (project) => {
      toast.success(t("Project imported"))
      void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
      void navigate({ to: "/app/$orgSlug/$projectSlug", params: { orgSlug, projectSlug: project.slug } })
    },
    onError: (error: Error) => toast.error(t("Could not import repository"), { description: error.message }),
  })

  if (suggestedSlugQuery.error) {
    return (
      <Card>
        <CardHeader>
          <Button type="button" variant="ghost" className="mb-2 -ml-2 w-fit" onClick={onBack}>
            <ArrowLeftIcon />
            <T>Back</T>
          </Button>
          <CardTitle>
            <T>Create Project from repository</T>
          </CardTitle>
          <CardDescription>
            {repository.owner}/{repository.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldError>{suggestedSlugQuery.error.message}</FieldError>
        </CardContent>
      </Card>
    )
  }

  if (!suggestedSlugQuery.data) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <GitHubRepositoryConfigureForm
      hasEditedSlug={hasEditedSlug}
      importError={createFromRepository.error?.message}
      initialSlug={suggestedSlugQuery.data}
      branches={branches}
      branchError={branchesQuery.error?.message}
      isLoadingBranches={branchesQuery.isLoading}
      isImporting={createFromRepository.isPending}
      onBack={onBack}
      onCreate={(value) =>
        createFromRepository.mutate({
          data: {
            defaultBranchName: value.defaultBranchName.trim(),
            installationId,
            name: value.name,
            orgSlug,
            repositoryId: repository.id,
            repositoryName: repository.name,
            repositoryOwner: repository.owner,
            slug: value.slug.trim() || slugify(value.name),
          },
        })
      }
      repository={repository}
      setHasEditedSlug={setHasEditedSlug}
    />
  )
}

function GitHubRepositoryConfigureForm({
  branches,
  branchError,
  hasEditedSlug,
  importError,
  initialSlug,
  isLoadingBranches,
  isImporting,
  onBack,
  onCreate,
  repository,
  setHasEditedSlug,
}: {
  branches: Array<string>
  branchError?: string
  hasEditedSlug: boolean
  importError?: string
  initialSlug: string
  isLoadingBranches: boolean
  isImporting: boolean
  onBack: () => void
  onCreate: (value: { defaultBranchName: string; name: string; slug: string }) => void
  repository: GitHubRepository
  setHasEditedSlug: (hasEditedSlug: boolean) => void
}) {
  const t = useT()
  const form = useAppForm({
    defaultValues: {
      defaultBranchName: repository.defaultBranch,
      name: repository.name,
      slug: initialSlug,
    },
    validators: {
      onSubmit: z.object({
        defaultBranchName: z
          .string()
          .trim()
          .min(1, { error: t("Production Branch is required") })
          .max(100),
        name: z
          .string()
          .trim()
          .min(1, { error: t("Project name is required") })
          .max(120),
        slug: z.string().trim(),
      }),
    },
    onSubmit: ({ value }) => onCreate(value),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Create Project from repository</T>
        </CardTitle>
        <CardDescription>
          {repository.owner}/{repository.name}
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
                <field.NativeSelectField
                  label={t("Production Branch")}
                  description={t("Prefilled from the repository default branch.")}
                  disabled={isLoadingBranches}
                >
                  {isLoadingBranches ? (
                    <NativeSelectOption value={repository.defaultBranch}>{t("Loading branches...")}</NativeSelectOption>
                  ) : (
                    branches.map((branch) => (
                      <NativeSelectOption key={branch} value={branch}>
                        {branch}
                      </NativeSelectOption>
                    ))
                  )}
                </field.NativeSelectField>
              )}
            </form.AppField>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" aria-label={t("Back")} title={t("Back")} onClick={onBack}>
                <ArrowLeftIcon />
              </Button>
              <form.SubmitButton className="flex-1">
                {(isSubmitting) => (isSubmitting || isImporting ? <T>Creating...</T> : <T>Create project</T>)}
              </form.SubmitButton>
            </div>
            {branchError && <FieldError>{branchError}</FieldError>}
            <form.FormError>{importError}</form.FormError>
          </form>
        </form.AppForm>
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
