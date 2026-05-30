import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { CopyIcon, KeyRoundIcon, ShieldOffIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { createProjectApiKeyFn, projectDetailQueryOptions, revokeProjectApiKeyFn, type getProjectDetailFn } from "../-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectId/api-keys/")({
  component: ProjectApiKeysPage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("API keys")} · Better Translation` }] }
  },
})

type ProjectDetail = Awaited<ReturnType<typeof getProjectDetailFn>>
type ApiKeyRow = ProjectDetail["apiKeys"][number]

function ProjectApiKeysPage() {
  const { orgSlug, projectId } = Route.useParams()
  const t = useT()
  const queryClient = useQueryClient()
  const projectQuery = useQuery(projectDetailQueryOptions(orgSlug, projectId))
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const createApiKeyMutation = useMutation({
    mutationFn: (data: { name: string; orgSlug: string; projectId: string }) => createProjectApiKeyFn({ data }),
    onSuccess: ({ secret }) => {
      setNewSecret(secret)
      toast.success(t("API key created"))
      void queryClient.invalidateQueries({ queryKey: ["project-detail", orgSlug, projectId] })
      form.reset()
      setCreateOpen(false)
    },
    onError: (error: Error) => setApiKeyError(error.message),
  })

  const revokeApiKeyMutation = useMutation({
    mutationFn: (apiKeyId: number) => revokeProjectApiKeyFn({ data: { orgSlug, projectId, apiKeyId } }),
    onSuccess: () => {
      toast.success(t("API key revoked"))
      void queryClient.invalidateQueries({ queryKey: ["project-detail", orgSlug, projectId] })
    },
    onError: (error: Error) => toast.error(t("Could not revoke API key"), { description: error.message }),
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
      setApiKeyError(null)
      setNewSecret(null)
      createApiKeyMutation.mutate({ orgSlug, projectId, name: value.name.trim() })
    },
  })

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
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
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
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={Boolean(row.original.revokedAt) || revokeApiKeyMutation.isPending}
            onClick={() => revokeApiKeyMutation.mutate(row.original.id)}
          >
            <ShieldOffIcon />
            <T>Revoke</T>
          </Button>
        ),
      },
    ],
    [revokeApiKeyMutation, t],
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
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="w-fit" />}>
            <KeyRoundIcon />
            <T>Create API key</T>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <T>Create API key</T>
              </DialogTitle>
              <DialogDescription>
                <T>Save the generated key immediately. It will not be shown again.</T>
              </DialogDescription>
            </DialogHeader>
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
                  {(isSubmitting) =>
                    isSubmitting || createApiKeyMutation.isPending ? <T>Creating...</T> : <T>Create API key</T>
                  }
                </form.SubmitButton>
                <form.FormError>{apiKeyError}</form.FormError>
              </form>
            </form.AppForm>
          </DialogContent>
        </Dialog>
      </div>

      {newSecret && (
        <Alert>
          <KeyRoundIcon />
          <AlertTitle>
            <T>API key generated</T>
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <code className="block rounded-md bg-muted p-2 font-mono text-xs break-all">{newSecret}</code>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                void navigator.clipboard.writeText(newSecret)
                toast.success(t("Copied"))
              }}
            >
              <CopyIcon />
              <T>Copy</T>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardContent className="px-0">
          <DataTable columns={apiKeyColumns} data={projectQuery.data?.apiKeys} isLoading={projectQuery.isPending} />
        </CardContent>
      </Card>
    </div>
  )
}
