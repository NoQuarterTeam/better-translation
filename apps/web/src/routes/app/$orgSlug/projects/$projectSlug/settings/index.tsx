import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CopyIcon, ExternalLinkIcon, GitBranchIcon, UnplugIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { organizationProjectsQueryOptions } from "../../../-data"
import {
  connectProjectGitHubRepositoryFn,
  disconnectProjectGitHubFn,
  githubInstallationRepositoriesQueryOptions,
  projectSettingsQueryOptions,
  updateProjectGitHubCleanupFn,
  updateProjectNameFn,
  updateProjectTranslatorFn,
  type getProjectSettingsFn,
} from "./-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectSlug/settings/")({
  component: ProjectSettingsPage,
  validateSearch: z.object({
    githubInstallationId: z.string().optional().catch(undefined),
    githubSetupState: z.string().optional().catch(undefined),
  }),
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
  const project = useSuspenseQuery(projectSettingsQueryOptions(orgSlug, projectSlug)).data
  const projectSettingsQueryKey = projectSettingsQueryOptions(orgSlug, projectSlug).queryKey

  const updateProjectSettings = (updatedProject: ProjectSettings) => {
    queryClient.setQueryData<ProjectSettings>(projectSettingsQueryKey, updatedProject)
    void queryClient.invalidateQueries(organizationProjectsQueryOptions(orgSlug))
  }

  const updateNameMutation = useMutation({
    mutationFn: updateProjectNameFn,
    onSuccess: (updatedProject) => {
      toast.success(t("Project updated"))
      updateProjectSettings(updatedProject)
    },
  })

  const updateTranslatorMutation = useMutation({
    mutationFn: updateProjectTranslatorFn,
    onSuccess: (updatedProject) => {
      toast.success(t("Project translator updated"))
      updateProjectSettings(updatedProject)
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

  const translatorForm = useAppForm({
    defaultValues: {
      translationModel: project.translationModel,
      translationPrompt: project.translationPrompt,
    },
    validators: {
      onSubmit: z.object({
        translationModel: z.string().trim().min(1).max(120),
        translationPrompt: z.string().trim().min(1).max(4000),
      }),
    },
    onSubmit: ({ value }) => {
      updateTranslatorMutation.mutate({
        data: {
          ...value,
          orgSlug,
          projectSlug,
          translationModel: value.translationModel.trim(),
          translationPrompt: value.translationPrompt.trim(),
        },
      })
    },
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Project settings</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Manage Project profile, GitHub connection, and Platform translator settings.</T>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Project profile</T>
          </CardTitle>
          <CardDescription>
            <T>Update the Project display name.</T>
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

      <GitHubSettingsCard
        githubInstallationId={search.githubInstallationId}
        githubSetupState={search.githubSetupState}
        project={project}
        updateProjectSettings={updateProjectSettings}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Platform translator</T>
          </CardTitle>
          <CardDescription>
            <T>Configure the Platform translator for blank Locale values.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <translatorForm.AppForm>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void translatorForm.handleSubmit()
              }}
            >
              <translatorForm.AppField name="translationModel">
                {(field) => <field.TextField label={t("Translation model")} placeholder="openai/gpt-5.5" />}
              </translatorForm.AppField>
              <translatorForm.AppField name="translationPrompt">
                {(field) => (
                  <field.TextareaField
                    label={t("Translator guidance")}
                    placeholder={t("Tone, glossary, and style guidance")}
                    rows={5}
                  />
                )}
              </translatorForm.AppField>
              <translatorForm.SubmitButton className="w-fit">
                {(isSubmitting) =>
                  isSubmitting || updateTranslatorMutation.isPending ? <T>Saving...</T> : <T>Save translator</T>
                }
              </translatorForm.SubmitButton>
              <translatorForm.FormError>{updateTranslatorMutation.error?.message}</translatorForm.FormError>
            </form>
          </translatorForm.AppForm>
        </CardContent>
      </Card>
    </div>
  )
}

function GitHubSettingsCard({
  githubInstallationId,
  githubSetupState,
  project,
  updateProjectSettings,
}: {
  githubInstallationId?: string
  githubSetupState?: string
  project: ProjectSettings
  updateProjectSettings: (project: ProjectSettings) => void
}) {
  const { orgSlug, projectSlug } = Route.useParams()
  const navigate = useNavigate()
  const t = useT()
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("")
  const [cleanupEnabled, setCleanupEnabled] = useState(true)
  const repositoryQuery = useQuery(
    githubInstallationRepositoriesQueryOptions({
      installationId: githubInstallationId ?? "",
      orgSlug,
      projectSlug,
      setupState: githubSetupState ?? "",
    }),
  )
  const repositories = repositoryQuery.data ?? []
  const selectedRepository = repositories.find((repository) => repository.id === selectedRepositoryId) ?? repositories[0]

  const connectRepository = useMutation({
    mutationFn: connectProjectGitHubRepositoryFn,
    onSuccess: (updatedProject) => {
      toast.success(t("GitHub repository connected"))
      updateProjectSettings(updatedProject)
      void navigate({
        to: "/app/$orgSlug/projects/$projectSlug/settings",
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
            <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">
                  <T>No repository connected</T>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <T>Install the GitHub App, then choose the repository for this Project.</T>
                </p>
              </div>
              <Button
                type="button"
                disabled={!project.githubInstallUrl}
                render={project.githubInstallUrl ? <a href={project.githubInstallUrl} /> : undefined}
              >
                <GitBranchIcon />
                <T>Connect GitHub repository</T>
                <ExternalLinkIcon />
              </Button>
            </div>
            {!project.githubInstallUrl && (
              <p className="text-sm text-muted-foreground">
                <T>Set GITHUB_APP_SLUG before connecting GitHub repositories.</T>
              </p>
            )}
            {githubInstallationId && githubSetupState && (
              <form
                className="flex flex-col gap-4 rounded-md border p-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!selectedRepository) return
                  connectRepository.mutate({
                    data: {
                      githubBranchCleanupEnabled: cleanupEnabled,
                      installationId: githubInstallationId,
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
                  <FieldContent className="gap-0">
                    <FieldLabel htmlFor="githubRepository">
                      <T>Repository</T>
                    </FieldLabel>
                    <FieldDescription>
                      <T>Choose the repository this Project should be connected to.</T>
                    </FieldDescription>
                  </FieldContent>
                  <NativeSelect
                    id="githubRepository"
                    value={selectedRepository?.id ?? ""}
                    disabled={repositoryQuery.isLoading || repositories.length === 0}
                    onChange={(event) => setSelectedRepositoryId(event.target.value)}
                  >
                    {repositoryQuery.isLoading && (
                      <NativeSelectOption value="">{t("Loading repositories...")}</NativeSelectOption>
                    )}
                    {!repositoryQuery.isLoading && repositories.length === 0 && (
                      <NativeSelectOption value="">{t("No repositories available")}</NativeSelectOption>
                    )}
                    {repositories.map((repository) => (
                      <NativeSelectOption key={repository.id} value={repository.id}>
                        {repository.fullName}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="newGitHubBranchCleanupEnabled"
                    checked={cleanupEnabled}
                    onCheckedChange={(checked) => setCleanupEnabled(checked === true)}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="newGitHubBranchCleanupEnabled" className="cursor-pointer">
                      <T>Enable Branch cleanup</T>
                    </FieldLabel>
                    <FieldDescription>
                      <T>When GitHub deletes a branch, matching non-production Branches are archived automatically.</T>
                    </FieldDescription>
                  </FieldContent>
                </Field>
                <div>
                  <Button
                    type="submit"
                    disabled={!selectedRepository || connectRepository.isPending || repositoryQuery.isLoading}
                  >
                    <GitBranchIcon />
                    {connectRepository.isPending ? <T>Connecting...</T> : <T>Connect selected repository</T>}
                  </Button>
                </div>
                <FieldError>{repositoryQuery.error?.message ?? connectRepository.error?.message}</FieldError>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
