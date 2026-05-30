import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { createProjectFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_org/projects/new")({
  component: NewProjectPage,
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
  const { orgSlug } = Route.useParams()
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: {
      autoTranslate: boolean
      defaultLocale: string
      locales: string[]
      name: string
      orgSlug: string
      slug: string
      translationModel: string
      translationPrompt: string
    }) => createProjectFn({ data }),
    onSuccess: (project) => {
      toast.success(t("Project created"))
      void queryClient.invalidateQueries({ queryKey: ["projects", orgSlug] })
      void queryClient.invalidateQueries({ queryKey: ["organization-projects", orgSlug] })
      void navigate({ to: "/app/$orgSlug/projects/$projectId", params: { orgSlug, projectId: project.publicId } })
    },
    onError: (error: Error) => setApiError(error.message),
  })

  const form = useAppForm({
    defaultValues: {
      name: "",
      slug: "",
      defaultLocale: "en",
      locales: "en,nl",
      translationModel: "openai/gpt-5.5",
      translationPrompt: "Translate the provided UI messages as concise, natural application UI copy.",
      autoTranslate: true,
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Project name is required") })
          .max(120),
        slug: z.string().trim(),
        defaultLocale: z.string().trim().min(2).max(20),
        locales: z.string().trim().min(2),
        translationModel: z.string().trim().min(1).max(120),
        translationPrompt: z.string().trim().min(1).max(4000),
        autoTranslate: z.boolean(),
      }),
    },
    onSubmit: ({ value }) => {
      setApiError(null)
      const slug = value.slug.trim() || slugify(value.name)
      createMutation.mutate({
        ...value,
        orgSlug,
        slug,
        defaultLocale: value.defaultLocale.trim().toLowerCase(),
        locales: value.locales
          .split(",")
          .map((locale) => locale.trim().toLowerCase())
          .filter(Boolean),
      })
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New Project</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Create the hosted Project that one Consumer app will sync to.</T>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Project details</T>
          </CardTitle>
          <CardDescription>
            <T>The public Project id is generated after creation and is what the Vite plugin uses.</T>
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
                {(field) => <field.TextField label={t("Project name")} placeholder="Acme Web" />}
              </form.AppField>
              <form.AppField name="slug">
                {(field) => (
                  <field.TextField
                    label={t("Slug")}
                    placeholder="acme-web"
                    description={t("Leave blank to generate from the Project name.")}
                  />
                )}
              </form.AppField>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.AppField name="defaultLocale">
                  {(field) => <field.TextField label={t("Default locale")} placeholder="en" />}
                </form.AppField>
                <form.AppField name="locales">
                  {(field) => <field.TextField label={t("Locales")} placeholder="en,nl,de" />}
                </form.AppField>
              </div>
              <form.AppField name="translationModel">
                {(field) => <field.TextField label={t("Translation model")} placeholder="openai/gpt-5.5" />}
              </form.AppField>
              <form.AppField name="translationPrompt">
                {(field) => (
                  <field.TextareaField
                    label={t("Translator guidance")}
                    placeholder={t("Tone, glossary, and style guidance")}
                    rows={4}
                  />
                )}
              </form.AppField>
              <form.AppField name="autoTranslate">
                {(field) => (
                  <field.CheckboxField
                    label={t("Enable Platform translator")}
                    description={t("Allows AI fill-blank writes for this Project.")}
                  />
                )}
              </form.AppField>
              <form.SubmitButton className="w-full">
                {(isSubmitting) => (isSubmitting || createMutation.isPending ? <T>Creating...</T> : <T>Create Project</T>)}
              </form.SubmitButton>
              <form.FormError>{apiError}</form.FormError>
            </form>
          </form.AppForm>
        </CardContent>
      </Card>
    </div>
  )
}
