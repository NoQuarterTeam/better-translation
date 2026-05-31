import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Store, useSelector } from "@tanstack/react-store"
import type { ColumnDef } from "@tanstack/react-table"
import { BotIcon, CheckIcon, PencilIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

import { branchWorkspaceQueryOptions, saveLocaleValueFn, translateLocaleValueFn, type getBranchWorkspaceFn } from "./-data"

export const Route = createFileRoute("/app/$orgSlug/projects/$projectSlug/branches/$branchName/")({
  component: BranchPage,
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      branchWorkspaceQueryOptions(params.orgSlug, params.projectSlug, params.branchName),
    )
    return {
      crumb: {
        label: data.branch.name,
        url: `/app/${params.orgSlug}/projects/${params.projectSlug}/branches/${params.branchName}`,
      },
    }
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Messages")} · Better Translation` }] }
  },
})

const translationEditorStore = new Store({ locale: "", search: "" }, (store) => ({
  selectLocale: (locale: string) => store.setState((state) => ({ ...state, locale })),
  setSearch: (search: string) => store.setState((state) => ({ ...state, search })),
}))

type BranchWorkspace = Awaited<ReturnType<typeof getBranchWorkspaceFn>>
type MessageRow = BranchWorkspace["messages"][number]

function BranchPage() {
  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const t = useT()
  const branchQuery = useSuspenseQuery(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))
  const locale = useSelector(translationEditorStore, (state) => state.locale)
  const search = useSelector(translationEditorStore, (state) => state.search)
  const resolvedLocale =
    locale && branchQuery.data.project.locales.includes(locale)
      ? locale
      : (branchQuery.data.project.locales.find((projectLocale) => projectLocale !== branchQuery.data.project.defaultLocale) ??
        branchQuery.data.project.defaultLocale)

  const filteredMessages = useMemo(() => {
    const messages = branchQuery.data.messages
    const query = search.trim().toLowerCase()
    if (!query) return messages
    return messages.filter((message) =>
      [message.defaultMessage, message.localeValues[resolvedLocale]?.value ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [branchQuery.data.messages, resolvedLocale, search])

  const columns = useMemo<ColumnDef<MessageRow>[]>(
    () => [
      {
        id: "translation",
        header: resolvedLocale || t("Locale"),
        cell: ({ row }) => {
          const localeValue = row.original.localeValues[resolvedLocale]
          return (
            <div className="max-w-3xl">
              <div className="truncate">{localeValue?.value ?? row.original.defaultMessage}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                <T>Original</T>: {row.original.defaultMessage}
              </div>
            </div>
          )
        },
      },
      {
        id: "status",
        header: t("Status"),
        cell: ({ row }) => {
          const localeValue = row.original.localeValues[resolvedLocale]
          if (localeValue?.source === "manual") return <Badge>{t("Manual")}</Badge>
          if (localeValue?.source === "ai") return <Badge variant="secondary">{t("AI")}</Badge>
          if (localeValue?.source === "imported") return <Badge variant="secondary">{t("Imported")}</Badge>
          return <Badge variant="outline">{t("Default")}</Badge>
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <TranslationValueDialog
            branchName={branchName}
            defaultLocale={branchQuery.data.project.defaultLocale}
            locale={resolvedLocale}
            message={row.original}
            orgSlug={orgSlug}
            projectSlug={projectSlug}
          />
        ),
      },
    ],
    [branchName, branchQuery.data.project.defaultLocale, orgSlug, projectSlug, resolvedLocale, t],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Messages</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Edit branch-local Locale values and fill blanks with the Platform translator.</T>
          </p>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden">
        <CardHeader className="border-b">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
            <InputGroup>
              <InputGroupInput
                value={search}
                onChange={(event) => translationEditorStore.actions.setSearch(event.target.value)}
                placeholder={t("Search translations")}
              />
              <InputGroupAddon align="inline-start">
                <SearchIcon className="text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
            <Field className="gap-0">
              <FieldLabel htmlFor="translation-locale" className="sr-only">
                {t("Locale")}
              </FieldLabel>
              <Select
                value={resolvedLocale}
                onValueChange={(nextLocale) => translationEditorStore.actions.selectLocale((nextLocale as string) ?? "")}
              >
                <SelectTrigger id="translation-locale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {branchQuery.data.project.locales.map((projectLocale) => (
                      <SelectItem key={projectLocale} value={projectLocale}>
                        {projectLocale}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredMessages} />
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
  projectSlug,
}: {
  branchName: string
  defaultLocale: string
  locale: string
  message: MessageRow
  orgSlug: string
  projectSlug: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="ml-auto" />}>
        <PencilIcon />
        <T>Edit</T>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <T>Customize translation</T>
          </DialogTitle>
          <DialogDescription>
            <T>Review the original copy and current translation, then save a custom version for this Branch.</T>
          </DialogDescription>
        </DialogHeader>
        <TranslationValueEditor
          key={`${message.lookupId}:${locale}:${open ? "open" : "closed"}`}
          branchName={branchName}
          defaultLocale={defaultLocale}
          locale={locale}
          message={message}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
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
  projectSlug,
}: {
  branchName: string
  defaultLocale: string
  locale: string
  message: MessageRow
  onSaved: () => void
  orgSlug: string
  projectSlug: string
}) {
  const t = useT()
  const { queryClient } = Route.useRouteContext()
  const localeValue = message.localeValues[locale]
  const isDefaultLocale = locale === defaultLocale
  const currentValue = localeValue?.value ?? message.defaultMessage
  const sourceLabel =
    localeValue?.source === "manual"
      ? t("Custom")
      : localeValue?.source === "ai"
        ? t("AI translated")
        : localeValue?.source === "imported"
          ? t("Imported")
          : t("Using original")
  const sourceVariant = localeValue?.source === "manual" ? "default" : localeValue?.source === "default" ? "outline" : "secondary"

  const saveMutation = useMutation({
    mutationFn: (data: { value: string }) =>
      saveLocaleValueFn({
        data: { branchName, locale, lookupId: message.lookupId, orgSlug, projectSlug, value: data.value },
      }),
    onSuccess: () => {
      toast.success(t("Locale value saved"))
      void queryClient.invalidateQueries(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))
      onSaved()
    },
    onError: (error: Error) => toast.error(t("Could not save Locale value"), { description: error.message }),
  })

  const translateMutation = useMutation({
    mutationFn: () => translateLocaleValueFn({ data: { branchName, locale, lookupId: message.lookupId, orgSlug, projectSlug } }),
    onSuccess: () => {
      toast.success(t("Platform translator saved a Locale value"))
      void queryClient.invalidateQueries(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="text-xs font-medium text-muted-foreground">
            <T>Original</T> · {defaultLocale}
          </div>
          <p className="mt-2 text-base leading-7">{message.defaultMessage}</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              <T>Current translation</T> · {locale}
            </div>
            <Badge variant={sourceVariant}>{sourceLabel}</Badge>
          </div>
          <p className="mt-2 text-base leading-7">{currentValue}</p>
        </div>
      </div>
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
                label={t("Custom version")}
                description={
                  isDefaultLocale
                    ? t("The Default locale is the original copy and cannot be customized here.")
                    : t("Saved custom versions apply to this Branch.")
                }
                placeholder={t("Write the translation people should see")}
                rows={5}
                disabled={isDefaultLocale}
              />
            )}
          </form.AppField>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form.SubmitButton size="lg" className="w-full sm:flex-1" disabled={saveMutation.isPending || isDefaultLocale}>
              {(isSubmitting) =>
                isSubmitting || saveMutation.isPending ? (
                  <T>Saving...</T>
                ) : (
                  <>
                    <CheckIcon />
                    <T>Save custom translation</T>
                  </>
                )
              }
            </form.SubmitButton>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full sm:flex-1"
              disabled={translateMutation.isPending || isDefaultLocale}
              onClick={() => translateMutation.mutate()}
            >
              <BotIcon />
              {translateMutation.isPending ? <T>Translating...</T> : <T>Use AI translation</T>}
            </Button>
          </div>
        </form>
      </form.AppForm>
      <Separator />
      <div className="grid gap-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <div className="font-medium text-foreground">
            <T>Reference</T>
          </div>
          <div className="mt-1 font-mono">{message.lookupId}</div>
        </div>
        {message.sources[0] && (
          <div>
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
    </div>
  )
}
