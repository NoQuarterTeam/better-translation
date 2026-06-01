import { useMutation } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { authClient } from "@/lib/auth/client"

import { getAuthSessionFn } from "./-data"

export const Route = createFileRoute("/app/profile/")({
  component: ProfilePage,
  loader: async () => {
    const session = await getAuthSessionFn()
    return {
      user: session?.user,
    }
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Profile")} · Better Translation` }] }
  },
})

function ProfilePage() {
  const t = useT()
  const session = authClient.useSession()
  const data = Route.useLoaderData()
  const user = session.data?.user || data.user

  const updateProfile = useMutation({
    mutationFn: async (value: { name: string; image: string }) => {
      const result = await authClient.updateUser({
        name: value.name.trim(),
        image: value.image.trim() || null,
      })
      if (result.error) throw new Error(result.error.message ?? t("Could not update profile"))
    },
    onSuccess: async () => {
      await session.refetch()
      toast.success(t("Profile updated"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not update profile"))
    },
  })

  const form = useAppForm({
    defaultValues: {
      name: user?.name ?? "",
      image: user?.image ?? "",
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Name is required") }),
        image: z.url().or(z.literal("")),
      }),
    },
    onSubmit: ({ value }) => {
      updateProfile.mutate(value)
    },
  })

  return (
    <div className="flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Profile</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Manage your account details.</T>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Your details</T>
          </CardTitle>
          <CardDescription>
            <T>Update the profile information shown inside Better Translation.</T>
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
              <FieldGroup>
                <form.AppField name="name">
                  {(field) => <field.TextField label={t("Name")} placeholder="Jane Smith" autoComplete="name" />}
                </form.AppField>
                <form.AppField name="image">
                  {(field) => <field.TextField label={t("Image URL")} placeholder="https://example.com/avatar.png" />}
                </form.AppField>
                <div className="grid gap-2">
                  <FieldLabel>
                    <T>Email</T>
                  </FieldLabel>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{user?.email}</div>
                  <FieldDescription>
                    <T>Email changes are not enabled yet.</T>
                  </FieldDescription>
                </div>
              </FieldGroup>

              <form.FormError>{updateProfile.error}</form.FormError>

              <div>
                <form.SubmitButton disabled={updateProfile.isPending}>
                  {(isSubmitting) => (isSubmitting || updateProfile.isPending ? <T>Saving…</T> : <T>Save changes</T>)}
                </form.SubmitButton>
              </div>
            </form>
          </form.AppForm>
        </CardContent>
      </Card>
    </div>
  )
}
