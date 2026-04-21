import { createFileRoute, Link } from "@tanstack/react-router"
import { T, useT } from "better-translate/react"
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
  head: ({ match }) => ({
    meta: [
      {
        title:
          match.context.locale === "nl"
            ? "Aanmelden · Better Translate"
            : match.context.locale === "fr"
              ? "Se connecter · Better Translate"
              : match.context.locale === "es"
                ? "Iniciar sesion · Better Translate"
                : "Sign in · Better Translate",
      },
    ],
  }),
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const t = useT()

  const [apiError, setApiError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: z.object({
        email: z.email({ message: t("Email is required") }).min(3),
        password: z.string().min(8, { error: t("Password must be at least 8 characters long") }),
      }),
    },
    onSubmit: async ({ value }) => {
      setApiError(null)
      const callbackURL = redirect ?? "/dashboard"
      await authClient.signIn.email(
        { email: value.email.trim(), password: value.password, rememberMe: true, callbackURL },
        {
          onError: ({ error }) => {
            if (error.status === 403) {
              toast.error(t("Please verify your email address"), {
                description: t("An email has been sent to your inbox again."),
              })
              return
            }
            setApiError(error.message ?? t("Could not sign in"))
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
            <CardTitle>
              <T>Sign in</T>
            </CardTitle>
            <CardDescription>
              <T>Enter your email and password to continue.</T>
            </CardDescription>
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
              {(field) => <field.TextField label={t("Email")} type="email" autoComplete="email" placeholder="you@example.com" />}
            </form.AppField>

            <form.AppField name="password">
              {(field) => (
                <field.TextField label={t("Password")} type="password" autoComplete="current-password" placeholder="••••••••" />
              )}
            </form.AppField>

            <form.SubmitButton className="w-full">
              {(isSubmitting) => (isSubmitting ? <T>Signing in…</T> : <T>Sign in</T>)}
            </form.SubmitButton>
            <form.FormError>{apiError}</form.FormError>
          </form>
        </form.AppForm>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t pt-4">
        <p className="text-center text-sm text-muted-foreground">
          <T>Need a new account?</T>{" "}
          <Link to="/sign-up" className="text-primary underline-offset-4 hover:underline">
            <T>Sign up</T>
          </Link>
        </p>
        <div className="flex w-full items-center justify-center text-sm text-muted-foreground">
          <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            <T>Forgot your password?</T>
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
