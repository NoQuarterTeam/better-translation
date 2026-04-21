import { createFileRoute, Link } from "@tanstack/react-router"
import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"
import { AlertCircleIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { useAppForm } from "@/components/react-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

const MIN_PASSWORD = 8

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: z.object({
    token: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Reset password")} · Better Translation` }] }
  },
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = Route.useNavigate()
  const { token, error } = Route.useSearch()
  const t = useT()
  const [apiError, setApiError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: z
        .object({
          newPassword: z.string().min(MIN_PASSWORD),
          confirmPassword: z.string().min(MIN_PASSWORD),
        })
        .superRefine((data, ctx) => {
          if (data.newPassword !== data.confirmPassword) {
            ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: t("Passwords do not match") })
          }
        }),
    },
    onSubmit: async ({ value }) => {
      setApiError(null)

      if (!token) {
        setApiError(t("Missing reset token. Request a new password reset link."))
        return
      }

      await authClient.resetPassword(
        { token, newPassword: value.newPassword },
        {
          onError: ({ error }) => {
            setApiError(error.message ?? t("Could not reset password"))
          },
          onSuccess: async () => {
            const session = await authClient.getSession()
            if (session.data?.session) {
              void navigate({ to: "/dashboard" })
              return
            }

            toast.success(t("Password has been reset"))
            void navigate({ to: "/sign-in" })
          },
        },
      )
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Reset password</T>
        </CardTitle>
        <CardDescription>
          <T>Set a new password for your account.</T>
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
            <form.AppField name="newPassword">
              {(field) => (
                <field.TextField
                  label={t("New password")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  description={t("At least 8 characters")}
                />
              )}
            </form.AppField>

            <form.AppField name="confirmPassword">
              {(field) => (
                <field.TextField
                  label={t("Confirm password")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              )}
            </form.AppField>

            <form.SubmitButton disabled={!token}>
              {(isSubmitting) => (isSubmitting ? <T>Resetting password…</T> : <T>Reset password</T>)}
            </form.SubmitButton>

            {error && (
              <Alert>
                <AlertCircleIcon />
                <AlertTitle>
                  <T>Invalid or expired link</T>
                </AlertTitle>
                <AlertDescription>
                  <T>Request a new reset link and try again.</T>
                </AlertDescription>
              </Alert>
            )}

            <form.FormError>{apiError}</form.FormError>
          </form>
        </form.AppForm>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-4">
        <p className="text-center text-sm text-muted-foreground">
          <T>Need a new link?</T>{" "}
          <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            <T>Request password reset</T>
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
