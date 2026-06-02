import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { CopyIcon, KeyRoundIcon, MoreHorizontalIcon, ShieldOffIcon } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { createProjectApiKeyFn, projectApiKeysQueryOptions, revokeProjectApiKeyFn, type listProjectApiKeysFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug/api-keys/")({
  component: ProjectApiKeysPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectApiKeysQueryOptions(params.orgSlug, params.projectSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("API keys")} · Better Translation` }] }
  },
})

type ApiKeyRow = Awaited<ReturnType<typeof listProjectApiKeysFn>>[number]

function formatDate(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10)
}

function ProjectApiKeysPage() {
  const { orgSlug, projectSlug } = Route.useParams()
  const t = useT()
  const apiKeysQuery = useSuspenseQuery(projectApiKeysQueryOptions(orgSlug, projectSlug))

  const apiKeyColumns = useMemo<ColumnDef<ApiKeyRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("API key"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {row.original.keyPrefix}...{row.original.keyLastFour}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("Created"),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "revokedAt",
        header: t("Status"),
        cell: ({ row }) =>
          row.original.revokedAt ? <Badge variant="secondary">{t("Revoked")}</Badge> : <Badge>{t("Active")}</Badge>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <ApiKeyActions apiKey={row.original} />,
      },
    ],
    [t],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Project API keys</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Write credentials are used by plugin sync and never exposed to runtime bundle readers.</T>
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="w-fit" />}>
            <KeyRoundIcon />
            <T>Create API key</T>
          </DialogTrigger>
          <DialogContent>
            <CreateApiKeyDialogContent />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        <CardContent>
          <DataTable columns={apiKeyColumns} data={apiKeysQuery.data} />
        </CardContent>
      </Card>
    </div>
  )
}

function ApiKeyActions({ apiKey }: { apiKey: ApiKeyRow }) {
  const { orgSlug, projectSlug } = Route.useParams()
  const t = useT()
  const { queryClient } = Route.useRouteContext()
  const apiKeysQueryKey = projectApiKeysQueryOptions(orgSlug, projectSlug).queryKey
  const revokeApiKeyMutation = useMutation({
    mutationFn: revokeProjectApiKeyFn,
    onSuccess: (revokedApiKey) => {
      toast.success(t("API key revoked"))
      queryClient.setQueryData<ApiKeyRow[]>(apiKeysQueryKey, (apiKeys) => {
        if (!apiKeys) return apiKeys
        return apiKeys.map((row) => (row.id === revokedApiKey.id ? { ...row, revokedAt: revokedApiKey.revokedAt } : row))
      })
    },
    onError: (error: Error) => toast.error(t("Could not revoke API key"), { description: error.message }),
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <MoreHorizontalIcon />
        <span className="sr-only">API key actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={Boolean(apiKey.revokedAt) || revokeApiKeyMutation.isPending}
            variant="destructive"
            onClick={() => revokeApiKeyMutation.mutate({ data: { orgSlug, projectSlug, apiKeyId: apiKey.id } })}
          >
            <ShieldOffIcon />
            <T>Revoke</T>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CreateApiKeyDialogContent() {
  const { orgSlug, projectSlug } = Route.useParams()
  const t = useT()
  const { queryClient } = Route.useRouteContext()
  const apiKeysQueryKey = projectApiKeysQueryOptions(orgSlug, projectSlug).queryKey

  const createApiKeyMutation = useMutation({
    mutationFn: createProjectApiKeyFn,
    onSuccess: ({ apiKey }) => {
      toast.success(t("API key created"))
      queryClient.setQueryData<ApiKeyRow[]>(apiKeysQueryKey, (apiKeys) => (apiKeys ? [apiKey, ...apiKeys] : [apiKey]))
    },
  })

  const form = useAppForm({
    defaultValues: { name: "" },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("API key name is required") })
          .max(120),
      }),
    },
    onSubmit: ({ value }) => {
      createApiKeyMutation.mutate({ data: { orgSlug, projectSlug, name: value.name.trim() } })
    },
  })

  const generatedSecret = createApiKeyMutation.data?.secret

  return (
    <>
      <DialogHeader>
        <DialogTitle>{generatedSecret ? <T>API key generated</T> : <T>Create API key</T>}</DialogTitle>
        <DialogDescription>
          <T>Save the generated key immediately. It will not be shown again.</T>
        </DialogDescription>
      </DialogHeader>

      {generatedSecret ? (
        <div className="flex flex-col gap-4">
          <code className="block rounded-md bg-muted p-3 font-mono text-xs break-all">{generatedSecret}</code>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => {
                void navigator.clipboard.writeText(generatedSecret)
                toast.success(t("Copied"))
              }}
            >
              <CopyIcon />
              <T>Copy</T>
            </Button>
            <DialogClose render={<Button className="w-fit" />}>
              <T>Close</T>
            </DialogClose>
          </DialogFooter>
        </div>
      ) : (
        <form.AppForm>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.AppField name="name">
              {(field) => <field.TextField label={t("Key name")} placeholder="Production deploy sync" />}
            </form.AppField>
            <form.SubmitButton className="w-fit">
              {(isSubmitting) => (isSubmitting || createApiKeyMutation.isPending ? <T>Creating...</T> : <T>Create API key</T>)}
            </form.SubmitButton>
            <form.FormError>{createApiKeyMutation.error}</form.FormError>
          </form>
        </form.AppForm>
      )}
    </>
  )
}
