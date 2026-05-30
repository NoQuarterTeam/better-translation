import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { projectDetailQueryOptions, updateProjectLocalesFn, updateProjectNameFn, updateProjectTranslatorFn } from "../-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectId/settings/")({
  component: ProjectSettingsPage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Project settings")} · Better Translation` }] }
  },
})

function ProjectSettingsPage() {
  const { orgSlug, projectId } = Route.useParams()
  const t = useT()
  const queryClient = useQueryClient()
  const projectQuery = useQuery(projectDetailQueryOptions(orgSlug, projectId))
  const project = projectQuery.data?.project
  const [profileError, setProfileError] = useState<string | null>(null)
  const [localesError, setLocalesError] = useState<string | null>(null)
  const [translatorError, setTranslatorError] = useState<string | null>(null)

  const invalidateProject = () => {
    void queryClient.invalidateQueries({ queryKey: ["project-detail", orgSlug, projectId] })
    void queryClient.invalidateQueries({ queryKey: ["organization-projects", orgSlug] })
    void queryClient.invalidateQueries({ queryKey: ["projects", orgSlug] })
  }

  const updateNameMutation = useMutation({
    mutationFn: (data: { name: string; orgSlug: string; projectId: string }) => updateProjectNameFn({ data }),
    onSuccess: () => {
      toast.success(t("Project updated"))
      invalidateProject()
    },
    onError: (error: Error) => setProfileError(error.message),
  })

  const updateLocalesMutation = useMutation({
    mutationFn: (data: { defaultLocale: string; locales: string[]; orgSlug: string; projectId: string }) =>
      updateProjectLocalesFn({ data }),
    onSuccess: () => {
      toast.success(t("Project Locales updated"))
      invalidateProject()
    },
    onError: (error: Error) => setLocalesError(error.message),
  })

  const updateTranslatorMutation = useMutation({
    mutationFn: (data: {
      autoTranslate: boolean
      orgSlug: string
      projectId: string
      translationModel: string
      translationPrompt: string
    }) => updateProjectTranslatorFn({ data }),
    onSuccess: () => {
      toast.success(t("Project translator updated"))
      invalidateProject()
    },
    onError: (error: Error) => setTranslatorError(error.message),
  })

  const profileForm = useAppForm({
    defaultValues: { name: project?.name ?? "" },
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
      setProfileError(null)
      updateNameMutation.mutate({ orgSlug, projectId, name: value.name.trim() })
    },
  })

  const localesForm = useAppForm({
    defaultValues: {
      defaultLocale: project?.defaultLocale ?? "en",
      locales: project?.locales.join(",") ?? "en",
    },
    validators: {
      onSubmit: z.object({
        defaultLocale: z.string().trim().min(2).max(20),
        locales: z.string().trim().min(2),
      }),
    },
    onSubmit: ({ value }) => {
      setLocalesError(null)
      updateLocalesMutation.mutate({
        orgSlug,
        projectId,
        defaultLocale: value.defaultLocale.trim().toLowerCase(),
        locales: value.locales
          .split(",")
          .map((locale) => locale.trim().toLowerCase())
          .filter(Boolean),
      })
    },
  })

  const translatorForm = useAppForm({
    defaultValues: {
      translationModel: project?.translationModel ?? "openai/gpt-5.5",
      translationPrompt:
        project?.translationPrompt ?? "Translate the provided UI messages as concise, natural application UI copy.",
      autoTranslate: project?.autoTranslate ?? true,
    },
    validators: {
      onSubmit: z.object({
        translationModel: z.string().trim().min(1).max(120),
        translationPrompt: z.string().trim().min(1).max(4000),
        autoTranslate: z.boolean(),
      }),
    },
    onSubmit: ({ value }) => {
      setTranslatorError(null)
      updateTranslatorMutation.mutate({
        ...value,
        orgSlug,
        projectId,
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
          <T>Manage Project profile, Locale configuration, and Platform translator settings.</T>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Project profile</T>
          </CardTitle>
          <CardDescription>
            <T>The public Project id stays unchanged.</T>
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
              <profileForm.FormError>{profileError}</profileForm.FormError>
            </form>
          </profileForm.AppForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Locales</T>
          </CardTitle>
          <CardDescription>
            <T>Update the Default locale and supported Locale list for this Project.</T>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {project?.locales.map((locale) => (
              <Badge key={locale} variant={locale === project.defaultLocale ? "default" : "secondary"}>
                {locale}
              </Badge>
            ))}
          </div>
          <localesForm.AppForm>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void localesForm.handleSubmit()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <localesForm.AppField name="defaultLocale">
                  {(field) => <field.TextField label={t("Default locale")} placeholder="en" />}
                </localesForm.AppField>
                <localesForm.AppField name="locales">
                  {(field) => <field.TextField label={t("Locales")} placeholder="en,nl,de" />}
                </localesForm.AppField>
              </div>
              <localesForm.SubmitButton className="w-fit">
                {(isSubmitting) => (isSubmitting || updateLocalesMutation.isPending ? <T>Saving...</T> : <T>Save Locales</T>)}
              </localesForm.SubmitButton>
              <localesForm.FormError>{localesError}</localesForm.FormError>
            </form>
          </localesForm.AppForm>
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
              <translatorForm.AppField name="autoTranslate">
                {(field) => (
                  <field.CheckboxField
                    label={t("Enable Platform translator")}
                    description={t("Allows AI fill-blank writes for this Project.")}
                  />
                )}
              </translatorForm.AppField>
              <translatorForm.SubmitButton className="w-fit">
                {(isSubmitting) =>
                  isSubmitting || updateTranslatorMutation.isPending ? <T>Saving...</T> : <T>Save translator</T>
                }
              </translatorForm.SubmitButton>
              <translatorForm.FormError>{translatorError}</translatorForm.FormError>
            </form>
          </translatorForm.AppForm>
        </CardContent>
      </Card>
    </div>
  )
}
