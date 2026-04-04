import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { useAppForm } from "@/components/react-form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/_auth/sign-up")({
  component: SignUpPage,
  head: () => ({ meta: [{ title: "Sign up · Better Translate" }] }),
})

const MIN_PASSWORD = 8

function SignUpPage() {
  const navigate = Route.useNavigate()
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
          name: z.string().trim().min(1, { error: "Name is required" }),
          password: z.string().min(MIN_PASSWORD),
          confirmPassword: z.string().min(1, { error: "Confirm password is required" }),
        })
        .superRefine((data, ctx) => {
          if (data.password !== data.confirmPassword) {
            ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" })
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
            setApiError(error.message ?? "Could not sign up")
          },
          onSuccess: () => {
            toast.success("Account created", { description: "Please check your email for a verification link." })
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
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Sign up with your email to use Better Translate.</CardDescription>
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

            <form.AppField name="name">
              {(field) => <field.TextField label="Name" autoComplete="name" placeholder="Jane Doe" />}
            </form.AppField>

            <form.AppField name="password">
              {(field) => (
                <field.TextField
                  label="Password"
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

            <form.SubmitButton className="w-full">
              {(isSubmitting) => (isSubmitting ? "Creating account…" : "Create account")}
            </form.SubmitButton>
            <form.FormError>{apiError}</form.FormError>
          </form>
        </form.AppForm>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-4">
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
