import { uploadFile } from "@better-upload/client"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CopyIcon, GitBranchIcon, Loader2Icon, PlusIcon, Trash2Icon, UnplugIcon, UploadIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { ResourceMark } from "@/components/resource-mark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { imageUploadAccept, imageUploadMaxBytes, imageUploadMimeTypes } from "@/lib/image-upload"

import { currentProjectSwitcherQueryOptions, projectSwitcherProjectsQueryOptions } from "../-data"
import { GitHubAccountSelect, openGitHubSetup } from "../../../-components/github-account-select"
import {
  connectProjectGitHubRepositoryFn,
  confirmProjectIconUploadFn,
  disconnectProjectGitHubFn,
  githubInstallationRepositoriesQueryOptions,
  projectSettingsQueryOptions,
  removeProjectIconFn,
  updateProjectGitHubCleanupFn,
  updateProjectNameFn,
  type getProjectSettingsFn,
} from "./-data"

const githubInstallationIdSearchSchema = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined)

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug/settings/")({
  component: ProjectSettingsPage,
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
    await context.queryClient.ensureQueryData(projectSettingsQueryOptions(params.orgSlug, params.projectSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Project settings")} · Better Translation` }] }
  },
})

type ProjectSettings = Awaited<ReturnType<typeof getProjectSettingsFn>>

function ProjectSettingsPage() {
  const { orgSlug, projectSlug } = Route.useParams()
  const search = Route.useSearch()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const projectQuery = useSuspenseQuery(projectSettingsQueryOptions(orgSlug, projectSlug))
  const project = projectQuery.data
  const projectSettingsQueryKey = projectSettingsQueryOptions(orgSlug, projectSlug).queryKey
  const iconInputRef = useRef<HTMLInputElement>(null)

  const updateProjectSettings = (updatedProject: ProjectSettings) => {
    queryClient.setQueryData<ProjectSettings>(projectSettingsQueryKey, updatedProject)
    void queryClient.invalidateQueries(currentProjectSwitcherQueryOptions(orgSlug, projectSlug))
    void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
  }

  const updateNameMutation = useMutation({
    mutationFn: updateProjectNameFn,
    onSuccess: (updatedProject) => {
      toast.success(t("Project updated"))
      updateProjectSettings(updatedProject)
    },
  })

  const uploadIcon = useMutation({
    mutationFn: async (file: File) => {
      const result = await uploadFile({
        route: "projectIcon",
        file,
        metadata: { projectId: project.id },
        retry: 0,
      })
      const sourceKey = typeof result.metadata.sourceKey === "string" ? result.metadata.sourceKey : null
      if (!sourceKey) throw new Error(t("Project icon upload did not return a storage key"))

      return confirmProjectIconUploadFn({ data: { orgSlug, projectSlug, sourceKey } })
    },
    onSuccess: (updatedProject) => {
      toast.success(t("Project icon updated"))
      updateProjectSettings(updatedProject)
    },
    onError: (error) => {
      toast.error(error.message || t("Could not upload Project icon"))
    },
  })

  const removeIcon = useMutation({
    mutationFn: removeProjectIconFn,
    onSuccess: (updatedProject) => {
      toast.success(t("Project icon removed"))
      updateProjectSettings(updatedProject)
    },
    onError: (error) => {
      toast.error(error.message || t("Could not remove Project icon"))
    },
  })

  const profileForm = useAppForm({
    defaultValues: { name: project.name },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Project name is required") })
          .max(120),
      }),
    },
    onSubmit: ({ value }) => {
      updateNameMutation.mutate({ data: { orgSlug, projectSlug, name: value.name.trim() } })
    },
  })

  return (
    <div className="flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Project settings</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Manage Project profile and repository settings.</T>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Project name</T>
          </CardTitle>
          <CardDescription>
            <T>Give this project a name</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <profileForm.AppForm>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void profileForm.handleSubmit()
              }}
            >
              <profileForm.AppField name="name">
                {(field) => <field.TextField label={t("Project name")} placeholder="Acme Web" />}
              </profileForm.AppField>
              <profileForm.SubmitButton className="w-fit">
                {(isSubmitting) => (isSubmitting || updateNameMutation.isPending ? <T>Saving...</T> : <T>Save profile</T>)}
              </profileForm.SubmitButton>
              <profileForm.FormError>{updateNameMutation.error?.message}</profileForm.FormError>
            </form>
          </profileForm.AppForm>
        </CardContent>
      </Card>

      <GitHubSettingsCard
        githubInstallationId={search.githubInstallationId}
        githubSetupError={search.githubSetupError}
        githubSetupState={search.githubSetupState}
        isProjectSettingsFetching={projectQuery.isFetching}
        project={project}
        updateProjectSettings={updateProjectSettings}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Project id</T>
          </CardTitle>
          <CardDescription>
            <T>The public Project id stays unchanged.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-fit max-w-full items-center gap-2 rounded-md border bg-muted/30 p-1">
            <code className="min-w-0 truncate px-2 font-mono text-sm text-muted-foreground">{project.publicId}</code>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(project.publicId)
                toast.success(t("Copied"))
              }}
            >
              <CopyIcon />
              <T>Copy</T>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Project icon</T>
          </CardTitle>
          <CardDescription>
            <T>Shown in the Project switcher.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldContent className="items-start gap-4">
              <div className="flex items-start gap-4">
                <ResourceMark label={project.name} imageUrl={project.iconUrl} className="size-16 rounded-xl text-lg" />
                <div className="flex flex-col items-start gap-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadIcon.isPending || removeIcon.isPending}
                      onClick={() => iconInputRef.current?.click()}
                    >
                      {uploadIcon.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                      {project.iconUrl ? <T>Replace icon</T> : <T>Upload icon</T>}
                    </Button>
                    {project.iconUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadIcon.isPending || removeIcon.isPending}
                        onClick={() => removeIcon.mutate({ data: { orgSlug, projectSlug } })}
                      >
                        <Trash2Icon />
                        <T>Remove</T>
                      </Button>
                    )}
                  </div>
                  <FieldDescription>
                    <T>JPEG, PNG, WebP, or GIF up to 5 MB.</T>
                  </FieldDescription>
                </div>
              </div>
              <input
                ref={iconInputRef}
                type="file"
                accept={imageUploadAccept}
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ""
                  if (!file) return
                  if (file.size > imageUploadMaxBytes) {
                    toast.error(t("Image must be 5 MB or smaller"))
                    return
                  }
                  if (!imageUploadMimeTypes.includes(file.type)) {
                    toast.error(t("Unsupported image type"))
                    return
                  }

                  uploadIcon.mutate(file)
                }}
              />
            </FieldContent>
            <FieldLabel className="sr-only">
              <T>Project icon</T>
            </FieldLabel>
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}

function GitHubSettingsCard({
  githubInstallationId,
  githubSetupError,
  githubSetupState,
  isProjectSettingsFetching,
  project,
  updateProjectSettings,
}: {
  githubInstallationId?: string
  githubSetupError?: "missing_installation_id"
  githubSetupState?: string
  isProjectSettingsFetching: boolean
  project: ProjectSettings
  updateProjectSettings: (project: ProjectSettings) => void
}) {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const navigate = useNavigate()
  const t = useT()
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("")
  const [selectedInstallationId, setSelectedInstallationId] = useState(githubInstallationId ?? project.githubInstallationId ?? "")
  const activeGitHubInstallationId = project.githubInstallationId ?? selectedInstallationId
  const hasGitHubAccounts = project.githubInstallations.length > 0
  const isLoadingGitHubAccounts = isProjectSettingsFetching && !project.githubRepositoryId && !hasGitHubAccounts
  const repositoryQuery = useQuery(
    githubInstallationRepositoriesQueryOptions({
      installationId: activeGitHubInstallationId,
      orgSlug,
      projectSlug,
      setupState: githubSetupState,
    }),
  )
  const repositories = repositoryQuery.data ?? []
  const selectedRepository = repositories.find((repository) => repository.id === selectedRepositoryId)

  useEffect(() => {
    if (project.githubRepositoryId || selectedInstallationId || project.githubInstallations.length === 0) return
    setSelectedInstallationId(project.githubInstallations[0]?.installationId ?? "")
  }, [project.githubInstallations, project.githubRepositoryId, selectedInstallationId])

  const connectRepository = useMutation({
    mutationFn: connectProjectGitHubRepositoryFn,
    onSuccess: (updatedProject) => {
      toast.success(t("GitHub repository connected"))
      updateProjectSettings(updatedProject)
      void navigate({
        to: "/app/$orgSlug/$projectSlug/settings",
        params: { orgSlug, projectSlug },
        search: {},
      })
    },
    onError: (error: Error) => toast.error(t("Could not connect GitHub repository"), { description: error.message }),
  })

  const updateCleanup = useMutation({
    mutationFn: updateProjectGitHubCleanupFn,
    onSuccess: (updatedProject) => {
      toast.success(t("GitHub settings updated"))
      updateProjectSettings(updatedProject)
    },
    onError: (error: Error) => toast.error(t("Could not update GitHub settings"), { description: error.message }),
  })

  const disconnectRepository = useMutation({
    mutationFn: disconnectProjectGitHubFn,
    onSuccess: (updatedProject) => {
      toast.success(t("GitHub repository disconnected"))
      updateProjectSettings(updatedProject)
    },
    onError: (error: Error) => toast.error(t("Could not disconnect GitHub repository"), { description: error.message }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>GitHub</T>
        </CardTitle>
        <CardDescription>
          <T>Connect one repository to this Project for Branch cleanup.</T>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {project.githubRepositoryOwner && project.githubRepositoryName ? (
          <>
            <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <GitBranchIcon />
                  <span className="truncate">
                    {project.githubRepositoryOwner}/{project.githubRepositoryName}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <T>This Project only listens to Branch lifecycle events from this repository.</T>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={disconnectRepository.isPending}
                onClick={() => disconnectRepository.mutate({ data: { orgSlug, projectSlug } })}
              >
                <UnplugIcon />
                <T>Disconnect</T>
              </Button>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="githubBranchCleanupEnabled"
                checked={project.githubBranchCleanupEnabled}
                disabled={updateCleanup.isPending}
                onCheckedChange={(checked) =>
                  updateCleanup.mutate({
                    data: { orgSlug, projectSlug, githubBranchCleanupEnabled: checked === true },
                  })
                }
              />
              <FieldContent>
                <FieldLabel htmlFor="githubBranchCleanupEnabled" className="cursor-pointer">
                  <T>Enable Branch cleanup</T>
                </FieldLabel>
                <FieldDescription>
                  <T>
                    Deleted upstream branches archive matching non-production Branches. The Production Branch is never archived
                    automatically.
                  </T>
                </FieldDescription>
              </FieldContent>
            </Field>
          </>
        ) : (
          <>
            {!project.githubInstallUrl && (
              <p className="text-sm text-muted-foreground">
                <T>Set GITHUB_APP_SLUG before connecting GitHub repositories.</T>
              </p>
            )}
            {githubSetupError === "missing_installation_id" && (
              <FieldError>
                <T>
                  GitHub returned without an installation id. Check that the GitHub App Setup URL points to /api/github/setup,
                  then start the connection again.
                </T>
              </FieldError>
            )}
            {isLoadingGitHubAccounts ? (
              <GitHubSettingsSkeleton />
            ) : !hasGitHubAccounts ? (
              <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">
                    <T>No GitHub accounts connected</T>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <T>Connect GitHub before choosing a repository for this Project.</T>
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={!project.githubInstallUrl}
                  onClick={() =>
                    openGitHubSetup(project.githubInstallUrl, () => {
                      void queryClient.invalidateQueries(projectSettingsQueryOptions(orgSlug, projectSlug))
                    })
                  }
                >
                  <PlusIcon />
                  <T>Connect GitHub</T>
                </Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!selectedRepository || !activeGitHubInstallationId) return
                  connectRepository.mutate({
                    data: {
                      installationId: activeGitHubInstallationId,
                      orgSlug,
                      projectSlug,
                      repositoryId: selectedRepository.id,
                      repositoryName: selectedRepository.name,
                      repositoryOwner: selectedRepository.owner,
                      setupState: githubSetupState,
                    },
                  })
                }}
              >
                <Field>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <GitHubAccountSelect
                      className="flex shrink-0 gap-2"
                      githubInstallUrl={project.githubInstallUrl}
                      installations={project.githubInstallations}
                      onAddAccountComplete={() =>
                        void queryClient.invalidateQueries(projectSettingsQueryOptions(orgSlug, projectSlug))
                      }
                      onSelectInstallation={(installationId) => {
                        setSelectedInstallationId(installationId)
                        setSelectedRepositoryId("")
                      }}
                      selectedInstallationId={selectedInstallationId}
                    />
                    {activeGitHubInstallationId && (
                      <>
                        <NativeSelect
                          id="githubRepository"
                          className="min-w-0 flex-1"
                          value={selectedRepositoryId}
                          disabled={repositoryQuery.isLoading || repositories.length === 0}
                          onChange={(event) => setSelectedRepositoryId(event.target.value)}
                        >
                          {repositoryQuery.isLoading && (
                            <NativeSelectOption value="">{t("Loading repositories...")}</NativeSelectOption>
                          )}
                          {!repositoryQuery.isLoading && repositories.length === 0 && (
                            <NativeSelectOption value="">{t("No repositories available")}</NativeSelectOption>
                          )}
                          {!repositoryQuery.isLoading && repositories.length > 0 && (
                            <NativeSelectOption value="" disabled>
                              {t("Select repository...")}
                            </NativeSelectOption>
                          )}
                          {repositories.map((repository) => (
                            <NativeSelectOption key={repository.id} value={repository.id}>
                              {repository.fullName}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        <Button
                          type="submit"
                          className="shrink-0"
                          disabled={!selectedRepository || connectRepository.isPending || repositoryQuery.isLoading}
                        >
                          <GitBranchIcon />
                          {connectRepository.isPending ? <T>Connecting...</T> : <T>Connect</T>}
                        </Button>
                      </>
                    )}
                  </div>
                  {repositoryQuery.error && <FieldError>{repositoryQuery.error.message}</FieldError>}
                </Field>
                <FieldError>{repositoryQuery.error?.message ?? connectRepository.error?.message}</FieldError>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function GitHubSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 min-w-0 flex-1" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  )
}
