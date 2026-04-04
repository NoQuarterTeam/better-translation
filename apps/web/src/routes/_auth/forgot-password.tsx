import { createFileRoute, Link } from "@tanstack/react-router"
import { CheckCircle2Icon } from "lucide-react"
import { useState } from "react"
import * as z from "zod"

import { useAppForm } from "@/components/react-form"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Forgot password · Better Translate" }] }),
})

function ForgotPasswordPage() {
  const [apiError, setApiError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const form = useAppForm({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: z.object({ email: z.email().min(3) }),
    },
    onSubmit: async ({ value }) => {
      setApiError(null)
      await authClient.requestPasswordReset(
        { email: value.email.trim(), redirectTo: "/reset-password" },
        {
          onError: ({ error }) => {
            setApiError(error.message ?? "Could not send reset email")
          },
          onSuccess: () => {
            setEmailSent(true)
          },
        },
      )
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your account email and we will send you a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        {emailSent ? (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Email sent</AlertTitle>
            <AlertDescription>
              If an account exists for that email, you will receive a password reset link shortly.
            </AlertDescription>
            <AlertAction>
              <Button size="xs" variant="outline" onClick={() => setEmailSent(false)}>
                Send again
              </Button>
            </AlertAction>
          </Alert>
        ) : (
          <form.AppForm>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
            >
              <form.AppField name="email">
                {(field) => <field.TextField label="Email" type="email" autoComplete="email" placeholder="you@example.com" />}
              </form.AppField>

              <form.SubmitButton>{(isSubmitting) => (isSubmitting ? "Sending link…" : "Send reset link")}</form.SubmitButton>
              <form.FormError>{apiError}</form.FormError>
            </form>
          </form.AppForm>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
