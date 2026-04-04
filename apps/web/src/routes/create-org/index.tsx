import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import * as z from "zod"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

import { listUserOrganizationsFn } from "./-data"

export const Route = createFileRoute("/create-org/")({
  beforeLoad: async () => {
    const organizations = await listUserOrganizationsFn()
    if (organizations.length > 0) throw redirect({ to: "/dashboard" })
  },
  component: CreateOrgPage,
  head: () => ({ meta: [{ title: "Create organization · Better Translate" }] }),
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
  const [apiError, setApiError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { name: "", slug: "" },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, { error: "Organization name is required" }).max(120),
        slug: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      setApiError(null)
      const rawSlug = value.slug.trim() || slugify(value.name)
      const parsedSlug = slugSchema.safeParse(rawSlug)
      if (!parsedSlug.success) {
        setApiError(parsedSlug.error.issues[0]?.message ?? "Invalid slug")
        return
      }
      await authClient.organization.create(
        { name: value.name.trim(), slug: parsedSlug.data },
        {
          onError: ({ error }) => {
            setApiError(error.message ?? "Could not create organization")
          },
          onSuccess: () => {
            void navigate({ to: "/dashboard" })
          },
        },
      )
    },
  })

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>This workspace is shared with your team. You can invite people after you finish.</CardDescription>
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
                  <field.TextField label="Organization name" placeholder="Acme Localization" autoComplete="organization" />
                )}
              </form.AppField>
              <form.AppField name="slug">
                {(field) => (
                  <field.TextField
                    label="URL slug"
                    placeholder="acme-localization"
                    description="Lowercase, hyphens only. Used in URLs and must be unique."
                  />
                )}
              </form.AppField>
              <form.SubmitButton className="w-full">
                {(isSubmitting) => (isSubmitting ? "Creating…" : "Create organization")}
              </form.SubmitButton>
              <form.FormError>{apiError}</form.FormError>
            </form>
          </form.AppForm>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <p className="text-center text-sm text-muted-foreground">
            You’re signed in. After this step you’ll land on your dashboard.
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
