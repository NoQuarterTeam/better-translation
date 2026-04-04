import { createFileRoute, Link } from "@tanstack/react-router"
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
  head: () => ({ meta: [{ title: "Reset password · Better Translation" }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = Route.useNavigate()
  const { token, error } = Route.useSearch()
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
            ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" })
          }
        }),
    },
    onSubmit: async ({ value }) => {
      setApiError(null)

      if (!token) {
        setApiError("Missing reset token. Request a new password reset link.")
        return
      }

      await authClient.resetPassword(
        { token, newPassword: value.newPassword },
        {
          onError: ({ error }) => {
            setApiError(error.message ?? "Could not reset password")
          },
          onSuccess: async () => {
            const session = await authClient.getSession()
            if (session.data?.session) {
              void navigate({ to: "/dashboard" })
              return
            }

            toast.success("Password has been reset")
            void navigate({ to: "/sign-in" })
          },
        },
      )
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Set a new password for your account.</CardDescription>
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
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  description={`At least ${MIN_PASSWORD} characters`}
                />
              )}
            </form.AppField>

            <form.AppField name="confirmPassword">
              {(field) => (
                <field.TextField label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" />
              )}
            </form.AppField>

            <form.SubmitButton disabled={!token}>
              {(isSubmitting) => (isSubmitting ? "Resetting password…" : "Reset password")}
            </form.SubmitButton>

            {error && (
              <Alert>
                <AlertCircleIcon />
                <AlertTitle>Invalid or expired link</AlertTitle>
                <AlertDescription>Request a new reset link and try again.</AlertDescription>
              </Alert>
            )}

            <form.FormError>{apiError}</form.FormError>
          </form>
        </form.AppForm>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-4">
        <p className="text-center text-sm text-muted-foreground">
          Need a new link?{" "}
          <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            Request password reset
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
