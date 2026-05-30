import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { currentOrganizationQueryOptions, useCurrentOrganization } from "../../-data"
import { updateOrganizationNameFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_org/settings/")({
  component: OrganizationSettingsPage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Organization settings")} · Better Translation` }] }
  },
})

function OrganizationSettingsPage() {
  const { orgSlug } = Route.useParams()
  const { organization } = useCurrentOrganization()
  const t = useT()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; orgSlug: string }) => updateOrganizationNameFn({ data }),
    onSuccess: () => {
      toast.success(t("Organization updated"))
      void queryClient.invalidateQueries({ queryKey: currentOrganizationQueryOptions(orgSlug).queryKey })
    },
    onError: (error: Error) => setApiError(error.message),
  })

  const form = useAppForm({
    defaultValues: { name: organization.name },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Organization name is required") })
          .max(120),
      }),
    },
    onSubmit: ({ value }) => {
      setApiError(null)
      updateMutation.mutate({ orgSlug, name: value.name.trim() })
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Organization settings</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Manage organization profile details and team-level configuration.</T>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Organization profile</T>
          </CardTitle>
          <CardDescription>
            <T>The URL slug stays unchanged.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form.AppForm>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
            >
              <form.AppField name="name">
                {(field) => <field.TextField label={t("Organization name")} placeholder="Acme Localization" />}
              </form.AppField>
              <form.SubmitButton className="w-fit">
                {(isSubmitting) => (isSubmitting || updateMutation.isPending ? <T>Saving...</T> : <T>Save profile</T>)}
              </form.SubmitButton>
              <form.FormError>{apiError}</form.FormError>
            </form>
          </form.AppForm>
        </CardContent>
      </Card>
    </div>
  )
}
