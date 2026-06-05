import { Avatar, AvatarFallback, AvatarImage } from "@better-translation/ui/components/avatar"
import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@better-translation/ui/components/field"
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
import { imageUploadAccept, imageUploadMaxBytes, imageUploadMimeTypes } from "@/lib/image-upload"

import { confirmUserAvatarUploadFn, removeUserAvatarFn, updateProfileNameFn, userProfileQueryOptions } from "./-data"

export const Route = createFileRoute("/app/account/")({
  component: ProfilePage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(userProfileQueryOptions())
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Profile")} · Better Translation` }] }
  },
})

function ProfilePage() {
  const t = useT()
  const queryClient = Route.useRouteContext().queryClient
  const user = useSuspenseQuery(userProfileQueryOptions()).data
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const updateProfile = useMutation({
    mutationFn: updateProfileNameFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries(userProfileQueryOptions())
      toast.success(t("Profile updated"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not update profile"))
    },
  })

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const result = await uploadFile({
        route: "userAvatar",
        file,
        metadata: {},
        retry: 0,
      })
      const sourceKey = typeof result.metadata.sourceKey === "string" ? result.metadata.sourceKey : null
      if (!sourceKey) throw new Error(t("Profile image upload did not return a storage key"))

      return confirmUserAvatarUploadFn({ data: { sourceKey } })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(userProfileQueryOptions())
      toast.success(t("Profile image updated"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not upload profile image"))
    },
  })

  const removeAvatar = useMutation({
    mutationFn: removeUserAvatarFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries(userProfileQueryOptions())
      toast.success(t("Profile image removed"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not remove profile image"))
    },
  })

  const form = useAppForm({
    defaultValues: {
      name: user?.name ?? "",
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Name is required") }),
      }),
    },
    onSubmit: ({ value }) => {
      updateProfile.mutate({ data: { name: value.name } })
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
                <Field>
                  <FieldLabel>
                    <T>Profile image</T>
                  </FieldLabel>
                  <FieldContent className="items-start gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="size-16">
                        <AvatarImage src={user?.imageUrl || undefined} alt={user?.name || user?.email || ""} />
                        <AvatarFallback>{createInitials(user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start gap-2 pt-1">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadAvatar.isPending || removeAvatar.isPending}
                            onClick={() => avatarInputRef.current?.click()}
                          >
                            {uploadAvatar.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                            {user?.imageUrl ? <T>Replace image</T> : <T>Upload image</T>}
                          </Button>
                          {user?.imageUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={uploadAvatar.isPending || removeAvatar.isPending}
                              onClick={() => removeAvatar.mutate({ data: undefined })}
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
                      ref={avatarInputRef}
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

                        uploadAvatar.mutate(file)
                      }}
                    />
                  </FieldContent>
                </Field>
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

function createInitials(user?: { name?: string | null }) {
  return (
    user?.name
      ?.split(" ")
      .map((name) => name[0])
      .join("") || ""
  )
}
