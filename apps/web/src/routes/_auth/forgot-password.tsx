import { Alert, AlertAction, AlertDescription, AlertTitle } from "@better-translation/ui/components/alert"
import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { createFileRoute, Link } from "@tanstack/react-router"
import { CheckCircle2Icon } from "lucide-react"
import { useState } from "react"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createT } from "better-translation/runtime"

import { useAppForm } from "@/components/react-form"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
  head: ({ match }) => {
    const t = createT(match.context.messages)
    return { meta: [{ title: `${t("Forgot password")} · Better Translation` }] }
  },
})

function ForgotPasswordPage() {
  const t = useT()
  const [apiError, setApiError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const form = useAppForm({
    defaultValues: {
      email: "",
    },
    validators: [
      {
        run: z.object({ email: z.email().min(3) }),
        triggers: [],
      },
    ],
    onSubmit: async ({ value }) => {
      setApiError(null)
      await authClient.requestPasswordReset(
        { email: value.email.trim(), redirectTo: "/reset-password" },
        {
          onError: ({ error }) => {
            setApiError(error.message ?? t("Could not send reset email"))
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
        <CardTitle>
          <T>Forgot password</T>
        </CardTitle>
        <CardDescription>
          <T>Enter your account email and we will send you a reset link.</T>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {emailSent ? (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>
              <T>Email sent</T>
            </AlertTitle>
            <AlertDescription>
              <T>If an account exists for that email, you will receive a password reset link shortly.</T>
            </AlertDescription>
            <AlertAction>
              <Button size="xs" variant="outline" onClick={() => setEmailSent(false)}>
                <T>Send again</T>
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
              <form.Field name="email">
                {(field) => (
                  <field.TextField label={t("Email")} type="email" autoComplete="email" placeholder="you@example.com" />
                )}
              </form.Field>

              <form.SubmitButton>
                {(isSubmitting) => (isSubmitting ? <T>Sending link…</T> : <T>Send reset link</T>)}
              </form.SubmitButton>
              <form.FormError>{apiError}</form.FormError>
            </form>
          </form.AppForm>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <p className="text-sm text-muted-foreground">
          <T>Remembered it?</T>{" "}
          <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">
            <T>Back to sign in</T>
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
