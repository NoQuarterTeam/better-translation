import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { AlertCircleIcon, MailCheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT, Var } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/_auth/verify-email")({
  validateSearch: z.object({ email: z.email().optional().catch(undefined) }),
  component: VerifyEmailPage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Verify your email")} · Better Translation` }] }
  },
})

function VerifyEmailPage() {
  const { email } = Route.useSearch()
  const t = useT()
  const [apiError, setApiError] = useState<string | null>(null)

  const { mutate: sendVerificationEmail, isPending } = useMutation({
    mutationFn: (email: string) => authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" }),
    onSuccess: (res) => {
      if (res.error) {
        setApiError(res.error.message ?? t("Could not send verification email"))
        return
      }
      toast.success(t("Verification email sent"))
    },
    onError: (error) => {
      setApiError(error.message ?? t("Could not send verification email"))
    },
  })

  const canResend = Boolean(email?.trim())

  const handleResend = async () => {
    if (!email?.trim()) {
      setApiError(t("Missing email. Please sign up again to request another verification email."))
      return
    }
    sendVerificationEmail(email.trim())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Verify your email</T>
        </CardTitle>
        <CardDescription>
          <T>Check your inbox and click the verification link to activate your account.</T>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <MailCheckIcon />
          <AlertTitle>
            <T>Verification email sent</T>
          </AlertTitle>
          <AlertDescription>
            {email ? (
              <T context="verify-email-with-address">
                We sent a verification link to <Var email={email} />. If you do not see it, check spam or resend below.
              </T>
            ) : (
              <T>We sent a verification link. If you do not see it, check spam or resend below.</T>
            )}
          </AlertDescription>
        </Alert>

        {apiError && (
          <Alert>
            <AlertCircleIcon />
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => void handleResend()} disabled={!canResend || isPending}>
          {isPending ? <T>Resending…</T> : <T>Resend email</T>}
        </Button>
        <Link to="/sign-in" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          <T>Back to sign in</T>
        </Link>
      </CardFooter>
    </Card>
  )
}
