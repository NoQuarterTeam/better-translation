import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@better-translation/ui/components/field"
import { uploadFile } from "@better-upload/client"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { ResourceMark } from "@/components/resource-mark"
import { imageUploadAccept, imageUploadMaxBytes, imageUploadMimeTypes } from "@/lib/image-upload"

import { currentOrganizationQueryOptions } from "../../-data"
import {
  confirmOrganizationLogoUploadFn,
  organizationSettingsQueryOptions,
  removeOrganizationLogoFn,
  updateOrganizationNameFn,
} from "./-data"

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
  const logoInputRef = useRef<HTMLInputElement>(null)

  const updateMutation = useMutation({
    mutationFn: updateOrganizationNameFn,
    onSuccess: () => {
      toast.success(t("Organization updated"))
      void queryClient.invalidateQueries(organizationSettingsQueryOptions(orgSlug))
      void queryClient.invalidateQueries(currentOrganizationQueryOptions(orgSlug))
    },
  })

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const result = await uploadFile({
        route: "organizationLogo",
        file,
        metadata: { organizationId: organization.id },
        retry: 0,
      })
      const sourceKey = typeof result.metadata.sourceKey === "string" ? result.metadata.sourceKey : null
      if (!sourceKey) throw new Error(t("Logo upload did not return a storage key"))

      return confirmOrganizationLogoUploadFn({ data: { orgSlug, sourceKey } })
    },
    onSuccess: () => {
      toast.success(t("Organization logo updated"))
      void queryClient.invalidateQueries(organizationSettingsQueryOptions(orgSlug))
      void queryClient.invalidateQueries(currentOrganizationQueryOptions(orgSlug))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not upload organization logo"))
    },
  })

  const removeLogo = useMutation({
    mutationFn: removeOrganizationLogoFn,
    onSuccess: () => {
      toast.success(t("Organization logo removed"))
      void queryClient.invalidateQueries(organizationSettingsQueryOptions(orgSlug))
      void queryClient.invalidateQueries(currentOrganizationQueryOptions(orgSlug))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not remove organization logo"))
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
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Organization logo</T>
          </CardTitle>
          <CardDescription>
            <T>Shown in the organization switcher.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldContent className="items-start gap-4">
              <div className="flex items-start gap-4">
                <ResourceMark label={organization.name} imageUrl={organization.logoUrl} className="size-16 rounded-xl text-lg" />
                <div className="flex flex-col items-start gap-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadLogo.isPending || removeLogo.isPending}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {uploadLogo.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                      {organization.logoUrl ? <T>Replace logo</T> : <T>Upload logo</T>}
                    </Button>
                    {organization.logoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadLogo.isPending || removeLogo.isPending}
                        onClick={() => removeLogo.mutate({ data: { orgSlug } })}
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
                ref={logoInputRef}
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

                  uploadLogo.mutate(file)
                }}
              />
            </FieldContent>
            <FieldLabel className="sr-only">
              <T>Organization logo</T>
            </FieldLabel>
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}
