import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

const signInSearchSchema = z.object({
  redirect: z.string().startsWith("/").max(500).optional().catch(undefined),
})

export const Route = createFileRoute("/_auth/sign-in")({
  validateSearch: signInSearchSchema,
  component: SignInPage,
  head: () => ({ meta: [{ title: "Sign in · Better Translate" }] }),
})

function SignInPage() {
  const navigate = Route.useNavigate()
  const { redirect } = Route.useSearch()

  const [apiError, setApiError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: z.object({ email: z.email().min(3), password: z.string().min(8) }),
    },
    onSubmit: async ({ value }) => {
      setApiError(null)
      const callbackURL = redirect ?? "/dashboard"
      await authClient.signIn.email(
        { email: value.email.trim(), password: value.password, rememberMe: true, callbackURL },
        {
          onError: ({ error }) => {
            if (error.status === 403) {
              toast.error("Please verify your email address", {
                description: "An email has been sent to your inbox again.",
              })
              return
            }
            setApiError(error.message ?? "Could not sign in")
          },
          onSuccess: () => {
            if (redirect) {
              window.location.assign(redirect)
              return
            }
            void navigate({ to: "/dashboard" })
          },
        },
      )
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your email and password to continue.</CardDescription>
          </div>
        </div>
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
            <form.AppField name="email">
              {(field) => <field.TextField label="Email" type="email" autoComplete="email" placeholder="you@example.com" />}
            </form.AppField>

            <form.AppField name="password">
              {(field) => (
                <field.TextField label="Password" type="password" autoComplete="current-password" placeholder="••••••••" />
              )}
            </form.AppField>

            <form.SubmitButton className="w-full">
              {(isSubmitting) => (isSubmitting ? "Signing in…" : "Sign in")}
            </form.SubmitButton>
            <form.FormError>{apiError}</form.FormError>
          </form>
        </form.AppForm>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t pt-4">
        <p className="text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link to="/sign-up" className="text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
        <div className="flex w-full items-center justify-center text-sm text-muted-foreground">
          <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
