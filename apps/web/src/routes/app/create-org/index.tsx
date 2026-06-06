import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/runtime"

import { useAppForm } from "@/components/react-form"
import { authClient } from "@/lib/auth/client"

import { CreateOrgLeadingSlot } from "./-components/create-org-leading"
import { userOrganizationsQueryOptions } from "./-data"

export const Route = createFileRoute("/app/create-org/")({
  staticData: {
    appShell: { topBar: { Leading: CreateOrgLeadingSlot } },
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(userOrganizationsQueryOptions())
  },
  component: CreateOrgPage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Create your organization")} · Better Translation` }] }
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

const slugSchema = z
  .string()
  .trim()
  .min(1, { error: "Slug is required" })
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers, and single hyphens" })

function CreateOrgPage() {
  const navigate = useNavigate()
  const t = useT()
  const [apiError, setApiError] = useState<string | null>(null)
  const [hasEditedSlug, setHasEditedSlug] = useState(false)

  const form = useAppForm({
    defaultValues: { name: "", slug: "" },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Organization name is required") })
          .max(120),
        slug: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      setApiError(null)
      const rawSlug = value.slug.trim() || slugify(value.name)
      const parsedSlug = slugSchema.safeParse(rawSlug)
      if (!parsedSlug.success) {
        setApiError(parsedSlug.error.issues[0]?.message ?? t("Invalid slug"))
        return
      }
      await authClient.organization.create(
        { name: value.name.trim(), slug: parsedSlug.data },
        {
          onError: ({ error }) => {
            setApiError(error.message ?? t("Could not create organization"))
          },
          onSuccess: () => {
            void navigate({ to: "/app/$orgSlug", params: { orgSlug: parsedSlug.data } })
          },
        },
      )
    },
  })

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <T>Create an organization</T>
          </CardTitle>
          <CardDescription>
            <T>This workspace is shared with your team. You can invite people after you finish.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form.AppForm>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
            >
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    label={t("Organization name")}
                    placeholder="Acme Localization"
                    autoComplete="organization"
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
                    placeholder="acme-localization"
                    description={t("Lowercase, hyphens only. Used in URLs and must be unique.")}
                    onChange={(e) => {
                      setHasEditedSlug(true)
                      field.handleChange(e.target.value)
                    }}
                  />
                )}
              </form.AppField>
              <form.SubmitButton className="w-full">
                {(isSubmitting) => (isSubmitting ? <T>Creating…</T> : <T>Create organization</T>)}
              </form.SubmitButton>
              <form.FormError>{apiError}</form.FormError>
            </form>
          </form.AppForm>
        </CardContent>
      </Card>
    </main>
  )
}
