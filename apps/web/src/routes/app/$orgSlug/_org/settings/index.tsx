import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { currentOrganizationQueryOptions } from "../../-data"
import { organizationSettingsQueryOptions, updateOrganizationNameFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_org/settings/")({
  component: OrganizationSettingsPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(organizationSettingsQueryOptions(params.orgSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Organization settings")} · Better Translation` }] }
  },
})

function OrganizationSettingsPage() {
  const { orgSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const organization = useSuspenseQuery(organizationSettingsQueryOptions(orgSlug)).data
  const t = useT()

  const updateMutation = useMutation({
    mutationFn: updateOrganizationNameFn,
    onSuccess: () => {
      toast.success(t("Organization updated"))
      void queryClient.invalidateQueries(organizationSettingsQueryOptions(orgSlug))
      void queryClient.invalidateQueries(currentOrganizationQueryOptions(orgSlug))
    },
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
      updateMutation.mutate({ data: { orgSlug, name: value.name.trim() } })
    },
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
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
              <form.FormError>{updateMutation.error?.message}</form.FormError>
            </form>
          </form.AppForm>
        </CardContent>
      </Card>
    </div>
  )
}
