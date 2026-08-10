import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createT } from "better-translation/runtime"

import { useAppForm } from "@/components/react-form"
import { authClient } from "@/lib/auth/client"

import { SocialAuthButtons } from "./-social-auth-buttons"

export const Route = createFileRoute("/_auth/sign-up")({
  validateSearch: z.object({
    redirect: z.string().startsWith("/").max(500).optional().catch(undefined),
  }),
  component: SignUpPage,
  head: ({ match }) => {
    const t = createT(match.context.messages)
    return { meta: [{ title: `${t("Create your account")} · Better Translation` }] }
  },
})

const MIN_PASSWORD = 8

function SignUpPage() {
  const navigate = Route.useNavigate()
  const { redirect } = Route.useSearch()
  const t = useT()
  const callbackURL = redirect ?? "/app"
  const [apiError, setApiError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
    },
    validators: [
      {
        run: z
          .object({
            email: z.email().trim().toLowerCase(),
            name: z
              .string()
              .trim()
              .min(1, { error: t("Name is required") }),
            password: z.string().min(MIN_PASSWORD),
            confirmPassword: z.string().min(1, { error: t("Confirm password is required") }),
          })
          .superRefine((data, ctx) => {
            if (data.password !== data.confirmPassword) {
              ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: t("Passwords do not match") })
            }
          }),
        triggers: [],
      },
    ],
    onSubmit: async ({ value }) => {
      setApiError(null)
      await authClient.signUp.email(
        {
          email: value.email.trim(),
          name: value.name.trim(),
          password: value.password,
          callbackURL,
        },
        {
          onError: ({ error }) => {
            setApiError(error.message ?? t("Could not sign up"))
          },
          onSuccess: () => {
            toast.success(t("Account created"), { description: t("Please check your email for a verification link.") })
            void navigate({ to: "/verify-email", search: { email: value.email.trim() } })
          },
        },
      )
    },
  })

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between">
        <div>
          <CardTitle>
            <T>Create your account</T>
          </CardTitle>
          <CardDescription>
            <T>Choose a sign-up method to use Better Translation.</T>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <SocialAuthButtons callbackURL={callbackURL} requestSignUp />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <T>or continue with email</T>
          <div className="h-px flex-1 bg-border" />
        </div>
        <form.AppForm>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="email">
              {(field) => <field.TextField label={t("Email")} type="email" autoComplete="email" placeholder="you@example.com" />}
            </form.Field>

            <form.Field name="name">
              {(field) => <field.TextField label={t("Name")} autoComplete="name" placeholder="Jane Doe" />}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <field.TextField
                  label={t("Password")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  description={t("At least 8 characters")}
                />
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <field.TextField
                  label={t("Confirm password")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              )}
            </form.Field>

            <form.SubmitButton className="w-full">
              {(isSubmitting) => (isSubmitting ? <T>Creating account…</T> : <T>Create account</T>)}
            </form.SubmitButton>
            <form.FormError>{apiError}</form.FormError>
          </form>
        </form.AppForm>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-4">
        <p className="text-center text-sm text-muted-foreground">
          <T>Already have an account?</T>{" "}
          <Link
            to="/sign-in"
            search={{ redirect: callbackURL === "/app" ? undefined : callbackURL }}
            className="text-primary underline-offset-4 hover:underline"
          >
            <T>Sign in</T>
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
