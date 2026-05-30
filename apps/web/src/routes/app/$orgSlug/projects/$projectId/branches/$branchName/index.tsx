import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Store, useSelector } from "@tanstack/react-store"
import type { ColumnDef } from "@tanstack/react-table"
import { BotIcon, CheckIcon, GitBranchIcon, PencilIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"

import { setSelectedBranchFn } from "../../-data"
import { getTranslationBranchWorkspaceFn, saveLocaleValueFn, translateLocaleValueFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectId/branches/$branchName/")({
  component: TranslationBranchPage,
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      branchWorkspaceQueryOptions(params.orgSlug, params.projectId, params.branchName),
    )
    await setSelectedBranchFn({ data: params })
    return {
      crumb: {
        label: data.branch.name,
        url: `/app/${params.orgSlug}/projects/${params.projectId}/branches/${params.branchName}`,
      },
    }
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Messages")} · Better Translation` }] }
  },
})

const branchWorkspaceQueryOptions = (orgSlug: string, projectId: string, branchName: string) => ({
  queryKey: ["translation-branch", orgSlug, projectId, branchName],
  queryFn: () => getTranslationBranchWorkspaceFn({ data: { orgSlug, projectId, branchName } }),
})

const translationEditorStore = new Store(
  {
    locale: "",
    search: "",
  },
  (store) => ({
    selectLocale: (locale: string) => store.setState((state) => ({ ...state, locale })),
    setSearch: (search: string) => store.setState((state) => ({ ...state, search })),
  }),
)

type BranchWorkspace = Awaited<ReturnType<typeof getTranslationBranchWorkspaceFn>>
type MessageRow = BranchWorkspace["messages"][number]

function TranslationBranchPage() {
  const { orgSlug, projectId, branchName } = Route.useParams()
  const t = useT()
  const branchQuery = useQuery(branchWorkspaceQueryOptions(orgSlug, projectId, branchName))
  const locale = useSelector(translationEditorStore, (state) => state.locale)
  const search = useSelector(translationEditorStore, (state) => state.search)
  const resolvedLocale =
    locale && branchQuery.data?.project.locales.includes(locale)
      ? locale
      : (branchQuery.data?.project.locales.find((projectLocale) => projectLocale !== branchQuery.data?.project.defaultLocale) ??
        branchQuery.data?.project.defaultLocale ??
        "")

  const filteredMessages = useMemo(() => {
    const messages = branchQuery.data?.messages ?? []
    const query = search.trim().toLowerCase()
    if (!query) return messages
    return messages.filter((message) =>
      [message.messageId, message.defaultMessage, message.localeValues[resolvedLocale]?.value ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [branchQuery.data?.messages, resolvedLocale, search])

  const columns = useMemo<ColumnDef<MessageRow>[]>(
    () => [
      {
        accessorKey: "messageId",
        header: t("Message"),
        cell: ({ row }) => (
          <div className="flex max-w-[30rem] items-center gap-2">
            <div className="min-w-0 flex-1 truncate font-mono text-xs" title={row.original.messageId}>
              {row.original.messageId}
            </div>
            <TranslationValueDialog
              branchName={branchName}
              defaultLocale={branchQuery.data?.project.defaultLocale ?? ""}
              locale={resolvedLocale}
              message={row.original}
              orgSlug={orgSlug}
              projectId={projectId}
            />
          </div>
        ),
      },
      {
        accessorKey: "defaultMessage",
        header: t("Default locale"),
        cell: ({ row }) => <div className="max-w-[24rem] truncate">{row.original.defaultMessage}</div>,
      },
      {
        id: "localeValue",
        header: resolvedLocale || t("Locale"),
        cell: ({ row }) => {
          const localeValue = row.original.localeValues[resolvedLocale]
          return <div className="max-w-[24rem] truncate">{localeValue?.value ?? row.original.defaultMessage}</div>
        },
      },
      {
        id: "status",
        header: t("Status"),
        cell: ({ row }) => {
          const localeValue = row.original.localeValues[resolvedLocale]
          if (localeValue?.source === "manual") return <Badge>{t("Manual")}</Badge>
          if (localeValue?.source === "ai") return <Badge variant="secondary">{t("AI")}</Badge>
          if (localeValue?.source === "inherited") return <Badge variant="secondary">{t("Inherited")}</Badge>
          return <Badge variant="outline">{t("Default")}</Badge>
        },
      },
    ],
    [branchName, branchQuery.data?.project.defaultLocale, orgSlug, projectId, resolvedLocale, t],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranchIcon />
            <span>{branchQuery.data?.project.name}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            <T>Messages</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Edit branch-local Locale values and fill blanks with the Platform translator.</T>
          </p>
        </div>
        {branchQuery.data?.parentBranch && (
          <Badge variant="secondary">
            <T>Inherits from</T> {branchQuery.data.parentBranch.name}
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4">
          <div>
            <CardTitle>{branchQuery.data?.branch.name ?? branchName}</CardTitle>
            <CardDescription>
              <T>Runtime bundles resolve each Message to the selected Locale value for this Translation Branch.</T>
            </CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
            <InputGroup>
              <InputGroupInput
                value={search}
                onChange={(event) => translationEditorStore.actions.setSearch(event.target.value)}
                placeholder={t("Search Messages")}
              />
              <InputGroupAddon align="inline-start">
                <SearchIcon className="text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
            <Field className="gap-1">
              <FieldContent className="gap-0">
                <FieldLabel htmlFor="translation-locale">{t("Locale")}</FieldLabel>
              </FieldContent>
              <NativeSelect
                id="translation-locale"
                value={resolvedLocale}
                onChange={(event) => translationEditorStore.actions.selectLocale(event.target.value)}
              >
                {branchQuery.data?.project.locales.map((projectLocale) => (
                  <option key={projectLocale} value={projectLocale}>
                    {projectLocale}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable columns={columns} data={filteredMessages} isLoading={branchQuery.isPending} />
        </CardContent>
      </Card>
    </div>
  )
}

function TranslationValueDialog({
  branchName,
  defaultLocale,
  locale,
  message,
  orgSlug,
  projectId,
}: {
  branchName: string
  defaultLocale: string
  locale: string
  message: MessageRow
  orgSlug: string
  projectId: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="ml-auto" />}>
        <PencilIcon />
        <T>Edit</T>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <T>Edit Locale value</T>
          </DialogTitle>
          <DialogDescription>
            <T>Saving writes a Branch override for this Message and Locale.</T>
          </DialogDescription>
        </DialogHeader>
        <TranslationValueEditor
          key={`${message.messageId}:${locale}:${open ? "open" : "closed"}`}
          branchName={branchName}
          defaultLocale={defaultLocale}
          locale={locale}
          message={message}
          orgSlug={orgSlug}
          projectId={projectId}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function TranslationValueEditor({
  branchName,
  defaultLocale,
  locale,
  message,
  onSaved,
  orgSlug,
  projectId,
}: {
  branchName: string
  defaultLocale: string
  locale: string
  message: MessageRow
  onSaved: () => void
  orgSlug: string
  projectId: string
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const localeValue = message.localeValues[locale]
  const isDefaultLocale = locale === defaultLocale

  const saveMutation = useMutation({
    mutationFn: (data: { value: string }) =>
      saveLocaleValueFn({
        data: { branchName, locale, messageId: message.messageId, orgSlug, projectId, value: data.value },
      }),
    onSuccess: () => {
      toast.success(t("Locale value saved"))
      void queryClient.invalidateQueries({ queryKey: ["translation-branch", orgSlug, projectId, branchName] })
      void queryClient.invalidateQueries({ queryKey: ["project-detail", orgSlug, projectId] })
      onSaved()
    },
    onError: (error: Error) => toast.error(t("Could not save Locale value"), { description: error.message }),
  })

  const translateMutation = useMutation({
    mutationFn: () => translateLocaleValueFn({ data: { branchName, locale, messageId: message.messageId, orgSlug, projectId } }),
    onSuccess: () => {
      toast.success(t("Platform translator saved a Locale value"))
      void queryClient.invalidateQueries({ queryKey: ["translation-branch", orgSlug, projectId, branchName] })
      void queryClient.invalidateQueries({ queryKey: ["project-detail", orgSlug, projectId] })
    },
    onError: (error: Error) => toast.error(t("Could not translate Message"), { description: error.message }),
  })

  const form = useAppForm({
    defaultValues: { value: localeValue?.value ?? message.defaultMessage },
    validators: {
      onSubmit: z.object({
        value: z
          .string()
          .trim()
          .min(1, { error: t("Locale value is required") }),
      }),
    },
    onSubmit: ({ value }) => saveMutation.mutate({ value: value.value }),
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono text-xs text-muted-foreground">{message.messageId}</div>
        <p className="mt-2 text-sm leading-6">{message.defaultMessage}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {localeValue?.source === "manual" && <Badge>{t("Manual override")}</Badge>}
        {localeValue?.source === "ai" && <Badge variant="secondary">{t("AI override")}</Badge>}
        {localeValue?.source === "inherited" && <Badge variant="secondary">{t("Inherited value")}</Badge>}
        {localeValue?.source === "default" && <Badge variant="outline">{t("Default locale fallback")}</Badge>}
      </div>
      <Separator />
      <form.AppForm>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.AppField name="value">
            {(field) => (
              <field.TextareaField
                label={t("Translation")}
                placeholder={t("Translated Locale value")}
                rows={8}
                disabled={isDefaultLocale}
              />
            )}
          </form.AppField>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form.SubmitButton className="flex-1" disabled={saveMutation.isPending || isDefaultLocale}>
              {(isSubmitting) =>
                isSubmitting || saveMutation.isPending ? (
                  <T>Saving...</T>
                ) : (
                  <>
                    <CheckIcon />
                    <T>Save override</T>
                  </>
                )
              }
            </form.SubmitButton>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={translateMutation.isPending || isDefaultLocale}
              onClick={() => translateMutation.mutate()}
            >
              <BotIcon />
              {translateMutation.isPending ? <T>Translating...</T> : <T>Translate</T>}
            </Button>
          </div>
        </form>
      </form.AppForm>
      {message.sources[0] && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">
            <T>Source</T>
          </div>
          <div className="mt-1 font-mono">
            {message.sources[0].file}
            {message.sources[0].line ? `:${message.sources[0].line}` : ""}
          </div>
        </div>
      )}
    </div>
  )
}
