import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { T, useT, Var } from "better-translate/react"
import { AlertCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"

import { getOrganizationInvitationFn } from "./-data"

export const Route = createFileRoute("/accept-invitation/$invitationId")({
  component: AcceptInvitationPage,
  head: ({ match }) => ({
    meta: [
      {
        title:
          match.context.locale === "nl"
            ? "Uitnodiging accepteren · Better Translate"
            : match.context.locale === "fr"
              ? "Accepter l'invitation · Better Translate"
              : match.context.locale === "es"
                ? "Aceptar invitacion · Better Translate"
                : "Accept invitation · Better Translate",
      },
    ],
  }),
})

function AcceptInvitationPage() {
  const { invitationId } = Route.useParams()
  const navigate = useNavigate()
  const t = useT()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const invitationQuery = useQuery({
    queryKey: ["organization-invitation", invitationId],
    queryFn: () => getOrganizationInvitationFn({ data: { invitationId } }),
    enabled: Boolean(session?.user && invitationId),
  })

  const acceptMutation = useMutation({
    mutationFn: () => authClient.organization.acceptInvitation({ invitationId }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(t("Could not accept invitation"), { description: result.error.message ?? result.error.statusText })
        return
      }
      toast.success(t("You’re in"))
      void navigate({ to: "/dashboard" })
    },
    onError: (error: Error) => {
      toast.error(t("Could not accept invitation"), { description: error.message })
    },
  })

  if (sessionPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          <T>Loading…</T>
        </p>
      </main>
    )
  }

  if (!session?.user) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              <T>Sign in to continue</T>
            </CardTitle>
            <CardDescription>
              <T>You need an account to accept this invitation. Use the same email the invitation was sent to.</T>
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 border-t pt-4">
            <Link
              to="/sign-in"
              search={{ redirect: `/accept-invitation/${invitationId}` }}
              className={cn(buttonVariants(), "w-full no-underline")}
            >
              <T>Sign in</T>
            </Link>
            <Link to="/sign-up" className={cn(buttonVariants({ variant: "outline" }), "w-full no-underline")}>
              <T>Create an account</T>
            </Link>
          </CardFooter>
        </Card>
      </main>
    )
  }

  const invErr = invitationQuery.error instanceof Error ? invitationQuery.error.message : null

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <T>Organization invitation</T>
          </CardTitle>
          <CardDescription>
            {invitationQuery.data?.organizationName ? (
              <T context="accept-invitation-organization-name">
                Join <Var organizationName={invitationQuery.data.organizationName} /> on Better Translate.
              </T>
            ) : (
              <T>Review your invitation below.</T>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitationQuery.isPending && (
            <p className="text-sm text-muted-foreground">
              <T>Loading invitation…</T>
            </p>
          )}
          {invitationQuery.isError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>
                <T>Could not load invitation</T>
              </AlertTitle>
              <AlertDescription>{invErr ?? t("Something went wrong.")}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t pt-4">
          <Button
            className="w-full"
            disabled={invitationQuery.isPending || !invitationQuery.data || acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
          >
            {acceptMutation.isPending ? <T>Accepting…</T> : <T>Accept invitation</T>}
          </Button>
          <Link to="/dashboard" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            <T>Back to dashboard</T>
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
