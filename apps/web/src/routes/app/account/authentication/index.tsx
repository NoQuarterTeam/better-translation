import { Badge } from "@better-translation/ui/components/badge"
import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { FieldDescription } from "@better-translation/ui/components/field"
import { Separator } from "@better-translation/ui/components/separator"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckIcon, LinkIcon, UnlinkIcon } from "lucide-react"
import { toast } from "sonner"

import { T, useT, Var } from "better-translation/react"
import { createT } from "better-translation/runtime"

import { authClient } from "@/lib/auth/client"

import { linkedAccountsQueryOptions } from "./-data"

const authProviders = [
  { id: "google", label: "Google", icon: GoogleMark },
  { id: "github", label: "GitHub", icon: GitHubMark },
] as const

type AuthProvider = (typeof authProviders)[number]["id"]

export const Route = createFileRoute("/app/account/authentication/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(linkedAccountsQueryOptions())
  },
  component: AuthenticationPage,
  head: ({ match }) => {
    const t = createT(match.context.messages)
    return { meta: [{ title: `${t("Authentication")} · Better Translation` }] }
  },
})

function AuthenticationPage() {
  const t = useT()
  const queryClient = Route.useRouteContext().queryClient
  const { data: linkedAccounts } = useSuspenseQuery(linkedAccountsQueryOptions())

  const linkProvider = useMutation({
    mutationFn: async (provider: AuthProvider) => {
      const result = await authClient.linkSocial({ provider, callbackURL: "/app/account/authentication" })
      if (result.error) throw new Error(result.error.message ?? t("Could not connect account"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not connect account"))
    },
  })

  const unlinkProvider = useMutation({
    mutationFn: async (provider: AuthProvider) => {
      const result = await authClient.unlinkAccount({ providerId: provider })
      if (result.error) throw new Error(result.error.message ?? t("Could not disconnect account"))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(linkedAccountsQueryOptions())
      toast.success(t("Account disconnected"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not disconnect account"))
    },
  })

  return (
    <div className="flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Authentication</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Manage sign-in methods for your Better Translation account.</T>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Connected accounts</T>
          </CardTitle>
          <CardDescription>
            <T>Use Google or GitHub to sign in to this Better Translation account.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            {authProviders.map((provider, index) => {
              const linkedAccount = linkedAccounts.find((account) => account.providerId === provider.id)
              const isConnected = Boolean(linkedAccount)
              const canUnlink = linkedAccounts.length > 1
              const Icon = provider.icon

              return (
                <div key={provider.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center justify-between gap-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-md border bg-background">
                        <Icon />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{provider.label}</p>
                          {isConnected && (
                            <Badge variant="secondary">
                              <CheckIcon data-icon="inline-start" />
                              <T>Connected</T>
                            </Badge>
                          )}
                        </div>
                        <FieldDescription>
                          {isConnected ? <T>Available as a sign-in method.</T> : providerConnectDescription(provider.label)}
                        </FieldDescription>
                      </div>
                    </div>

                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canUnlink || unlinkProvider.isPending}
                        onClick={() => unlinkProvider.mutate(provider.id)}
                      >
                        <UnlinkIcon />
                        <T>Disconnect</T>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={linkProvider.isPending}
                        onClick={() => linkProvider.mutate(provider.id)}
                      >
                        <LinkIcon />
                        <T>Connect</T>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {linkedAccounts.length <= 1 && (
            <FieldDescription>
              <T>You need at least one connected account, so the last sign-in method cannot be disconnected.</T>
            </FieldDescription>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function providerConnectDescription(provider: string) {
  return (
    <T context="profile-connect-provider">
      Connect <Var provider={provider} /> as a sign-in method.
    </T>
  )
}

function GitHubMark() {
  return (
    <svg aria-hidden="true" className="size-4 fill-current" viewBox="0 0 24 24">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.42-4.04-1.42-.55-1.37-1.34-1.74-1.34-1.74-1.1-.73.08-.71.08-.71 1.2.08 1.84 1.22 1.84 1.22 1.08 1.8 2.82 1.28 3.51.98.11-.76.42-1.28.77-1.58-2.67-.3-5.47-1.31-5.47-5.84 0-1.29.47-2.34 1.23-3.16-.12-.3-.53-1.53.12-3.19 0 0 1-.32 3.3 1.21a11.6 11.6 0 0 1 6 0c2.3-1.53 3.3-1.21 3.3-1.21.66 1.66.25 2.89.12 3.19.77.82 1.23 1.87 1.23 3.16 0 4.54-2.8 5.54-5.48 5.84.43.37.82 1.1.82 2.23v3.31c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M21.81 12.23c0-.72-.06-1.25-.2-1.8H12.2v3.45h5.52c-.11.86-.72 2.16-2.08 3.03l-.02.12 3.01 2.28.21.02c1.96-1.77 2.97-4.36 2.97-7.1Z"
        fill="#4285F4"
      />
      <path
        d="M12.2 22c2.71 0 4.98-.87 6.64-2.37l-3.17-2.42c-.85.58-1.98.99-3.47.99-2.66 0-4.92-1.72-5.73-4.1l-.12.01-3.13 2.37-.04.11A10.06 10.06 0 0 0 12.2 22Z"
        fill="#34A853"
      />
      <path
        d="M6.47 14.1A5.88 5.88 0 0 1 6.13 12c0-.73.13-1.43.33-2.1l-.01-.14-3.17-2.41-.1.05A9.83 9.83 0 0 0 2.1 12c0 1.59.39 3.09 1.08 4.4l3.29-2.3Z"
        fill="#FBBC05"
      />
      <path
        d="M12.2 5.8c1.88 0 3.15.8 3.87 1.46l2.82-2.68C17.17 3.04 14.9 2 12.2 2 8.18 2 4.7 4.25 3.18 7.6l3.28 2.3c.82-2.38 3.08-4.1 5.74-4.1Z"
        fill="#EA4335"
      />
    </svg>
  )
}
