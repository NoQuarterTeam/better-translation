import { useMutation } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { AlertCircleIcon, MailCheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/_auth/verify-email")({
  validateSearch: z.object({ email: z.email().optional().catch(undefined) }),
  component: VerifyEmailPage,
  head: () => ({ meta: [{ title: "Verify your email · Better Translate" }] }),
})

function VerifyEmailPage() {
  const { email } = Route.useSearch()
  const [apiError, setApiError] = useState<string | null>(null)

  const { mutate: sendVerificationEmail, isPending } = useMutation({
    mutationFn: (email: string) => authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" }),
    onSuccess: (res) => {
      if (res.error) {
        setApiError(res.error.message ?? "Could not send verification email")
        return
      }
      toast.success("Verification email sent")
    },
    onError: (error) => {
      setApiError(error.message ?? "Could not send verification email")
    },
  })

  const canResend = Boolean(email?.trim())

  const handleResend = async () => {
    if (!email?.trim()) {
      setApiError("Missing email. Please sign up again to request another verification email.")
      return
    }
    sendVerificationEmail(email.trim())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>Check your inbox and click the verification link to activate your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <MailCheckIcon />
          <AlertTitle>Verification email sent</AlertTitle>
          <AlertDescription>
            We sent a verification link{email ? ` to ${email}` : ""}. If you do not see it, check spam or resend below.
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
          {isPending ? "Resending…" : "Resend email"}
        </Button>
        <Link to="/sign-in" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
