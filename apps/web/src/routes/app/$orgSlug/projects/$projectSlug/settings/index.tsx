import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CopyIcon } from "lucide-react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { organizationProjectsQueryOptions } from "../../../-data"
import { projectSettingsQueryOptions, updateProjectNameFn, updateProjectTranslatorFn, type getProjectSettingsFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectSlug/settings/")({
  component: ProjectSettingsPage,
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
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const project = useSuspenseQuery(projectSettingsQueryOptions(orgSlug, projectSlug)).data
  const projectSettingsQueryKey = projectSettingsQueryOptions(orgSlug, projectSlug).queryKey

  const updateProjectSettings = (updatedProject: ProjectSettings) => {
    queryClient.setQueryData<ProjectSettings>(projectSettingsQueryKey, updatedProject)
    void queryClient.invalidateQueries(organizationProjectsQueryOptions(orgSlug))
  }

  const updateNameMutation = useMutation({
    mutationFn: (data: { name: string; orgSlug: string; projectSlug: string }) => updateProjectNameFn({ data }),
    onSuccess: (updatedProject) => {
      toast.success(t("Project updated"))
      updateProjectSettings(updatedProject)
    },
  })

  const updateTranslatorMutation = useMutation({
    mutationFn: (data: { orgSlug: string; projectSlug: string; translationModel: string; translationPrompt: string }) =>
      updateProjectTranslatorFn({ data }),
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
      updateNameMutation.mutate({ orgSlug, projectSlug, name: value.name.trim() })
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
        ...value,
        orgSlug,
        projectSlug,
        translationModel: value.translationModel.trim(),
        translationPrompt: value.translationPrompt.trim(),
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
          <T>Manage Project profile and Platform translator settings.</T>
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
