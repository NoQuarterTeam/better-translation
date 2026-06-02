import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { projectTranslatorQueryOptions, updateProjectTranslatorFn, type getProjectTranslatorFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug/translator/")({
  component: ProjectTranslatorPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectTranslatorQueryOptions(params.orgSlug, params.projectSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Translator")} · Better Translation` }] }
  },
})

type ProjectTranslator = Awaited<ReturnType<typeof getProjectTranslatorFn>>

function ProjectTranslatorPage() {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const translatorQuery = useSuspenseQuery(projectTranslatorQueryOptions(orgSlug, projectSlug))
  const project = translatorQuery.data
  const projectTranslatorQueryKey = projectTranslatorQueryOptions(orgSlug, projectSlug).queryKey

  const updateTranslatorMutation = useMutation({
    mutationFn: updateProjectTranslatorFn,
    onSuccess: (updatedProject) => {
      toast.success(t("Project translator updated"))
      queryClient.setQueryData<ProjectTranslator>(projectTranslatorQueryKey, updatedProject)
    },
  })

  const translatorForm = useAppForm({
    defaultValues: {
      translationPrompt: project.translationPrompt,
    },
    validators: {
      onSubmit: z.object({
        translationPrompt: z.string().trim().min(1).max(4000),
      }),
    },
    onSubmit: ({ value }) => {
      updateTranslatorMutation.mutate({
        data: {
          orgSlug,
          projectSlug,
          translationPrompt: value.translationPrompt.trim(),
        },
      })
    },
  })

  return (
    <div className="flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Translator</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Configure how the Platform translator generates blank Locale values.</T>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Custom instructions</T>
          </CardTitle>
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
              <translatorForm.AppField name="translationPrompt">
                {(field) => (
                  <field.TextareaField
                    aria-label={t("Custom instructions")}
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
