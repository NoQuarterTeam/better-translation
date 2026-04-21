import { createFileRoute, Link } from "@tanstack/react-router"
import { T, useT } from "better-translation/react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/_auth/sign-up")({
  component: SignUpPage,
  head: ({ match }) => ({
    meta: [
      {
        title:
          match.context.locale === "nl"
            ? "Registreren · Better Translation"
            : match.context.locale === "fr"
              ? "S'inscrire · Better Translation"
              : match.context.locale === "es"
                ? "Crear cuenta · Better Translation"
                : "Sign up · Better Translation",
      },
    ],
  }),
})

const MIN_PASSWORD = 8

function SignUpPage() {
  const navigate = Route.useNavigate()
  const t = useT()
  const [apiError, setApiError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: z
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
    },
    onSubmit: async ({ value }) => {
      setApiError(null)
      await authClient.signUp.email(
        {
          email: value.email.trim(),
          name: value.name.trim(),
          password: value.password,
          callbackURL: "/dashboard",
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
            <T>Sign up with your email to use Better Translation.</T>
          </CardDescription>
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

            <form.AppField name="name">
              {(field) => <field.TextField label={t("Name")} autoComplete="name" placeholder="Jane Doe" />}
            </form.AppField>

            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label={t("Password")}
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
          <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">
            <T>Sign in</T>
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
