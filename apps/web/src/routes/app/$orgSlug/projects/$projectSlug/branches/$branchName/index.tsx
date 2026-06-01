import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { BotIcon, CheckIcon, KeyRoundIcon, LanguagesIcon, PencilIcon, SearchIcon, TerminalIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { formatLocale } from "@/lib/locales"

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

type BranchWorkspace = Awaited<ReturnType<typeof getBranchWorkspaceFn>>
type MessageRow = BranchWorkspace["messages"][number]

function getLocaleValue(message: MessageRow, locale: string) {
  return message.localeValues[locale]
}

function getLocaleEntries(message: MessageRow) {
  return Object.entries(message.localeValues)
}

function BranchPage() {
  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const { locale: appLocale } = Route.useRouteContext()
  const t = useT()
  const branchQuery = useSuspenseQuery(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))
  const [search, setSearch] = useState("")
  const editableLocales = branchQuery.data.branch.locales.filter(
    (branchLocale) => branchLocale !== branchQuery.data.branch.defaultLocale,
  )
  const hasMessages = branchQuery.data.messages.length > 0

  const filteredMessages = useMemo(() => {
    const messages = branchQuery.data.messages
    const query = search.trim().toLowerCase()
    if (!query) return messages
    return messages.filter((message) => {
      const searchableValues = [message.defaultMessage, ...getLocaleEntries(message).map(([, localeValue]) => localeValue.value)]
      return searchableValues.some((value) => value.toLowerCase().includes(query))
    })
  }, [branchQuery.data.messages, search])

  const columns = useMemo<ColumnDef<MessageRow>[]>(
    () => [
      {
        id: branchQuery.data.branch.defaultLocale,
        header: `${formatLocale(branchQuery.data.branch.defaultLocale, [appLocale])} (${t("Original")})`,
        cell: ({ row }) => <div className="max-w-2xl min-w-96 leading-6 whitespace-normal">{row.original.defaultMessage}</div>,
      },
      ...editableLocales.map(
        (locale): ColumnDef<MessageRow> => ({
          id: `locale-${locale}`,
          header: formatLocale(locale, [appLocale]),
          cell: ({ row }) => <EditableLocaleValueCell locale={locale} message={row.original} />,
        }),
      ),
    ],
    [appLocale, branchQuery.data.branch.defaultLocale, editableLocales, t],
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

      <Card>
        {hasMessages && (
          <CardHeader>
            <InputGroup>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Search messages")}
              />
              <InputGroupAddon align="inline-start">
                <SearchIcon className="text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
          </CardHeader>
        )}
        <CardContent>
          {hasMessages ? (
            <DataTable columns={columns} data={filteredMessages} />
          ) : (
            <Empty className="border-0">
              <EmptyHeader className="max-w-2xl">
                <EmptyMedia variant="icon">
                  <LanguagesIcon />
                </EmptyMedia>
                <EmptyTitle>
                  <T>No Messages on this Branch yet</T>
                </EmptyTitle>
                <EmptyDescription className="max-w-xl">
                  <T>
                    Start the dev server with the Better Translation Vite plugin enabled. Plugin sync will upload the Manifest for
                    this Branch, then Messages and Locale values will appear here.
                  </T>
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-3xl">
                <div className="grid w-full gap-3 text-left sm:grid-cols-2">
                  <div className="flex gap-3 rounded-md border bg-muted/30 p-4">
                    <TerminalIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        <T>Run your dev server</T>
                      </div>
                      <p className="text-muted-foreground">
                        <T>Use the command your app already uses, usually bun run dev.</T>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-md border bg-muted/30 p-4">
                    <KeyRoundIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        <T>Check Project credentials</T>
                      </div>
                      <p className="text-muted-foreground">
                        <T>Remote sync needs this Project id and a Project API key in the plugin config.</T>
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="mt-1 w-fit"
                  render={<Link to="/app/$orgSlug/projects/$projectSlug/api-keys" params={{ orgSlug, projectSlug }} />}
                >
                  <KeyRoundIcon />
                  <T>Manage API keys</T>
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EditableLocaleValueCell({ locale, message }: { locale: string; message: MessageRow }) {
  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const [open, setOpen] = useState(false)
  const localeValue = getLocaleValue(message, locale)
  const currentValue = localeValue?.value ?? message.defaultMessage

  const translateMutation = useMutation({
    mutationFn: translateLocaleValueFn,
    onSuccess: () => {
      toast.success(t("Platform translator saved a Locale value"))
      void queryClient.invalidateQueries(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))
    },
    onError: (error: Error) => toast.error(t("Could not translate Message"), { description: error.message }),
  })

  return (
    <div className="grid min-w-96 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 whitespace-normal">
      <div className="line-clamp-3 leading-6">{currentValue}</div>
      <ButtonGroup>
        <Button type="button" variant="outline" size="icon-sm" aria-label={t("Edit Locale value")} onClick={() => setOpen(true)}>
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("Use AI translation")}
          disabled={translateMutation.isPending}
          onClick={() =>
            translateMutation.mutate({ data: { branchName, locale, lookupId: message.lookupId, orgSlug, projectSlug } })
          }
        >
          <BotIcon />
        </Button>
      </ButtonGroup>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <T>Edit Locale value</T>
            </DialogTitle>
            <DialogDescription>
              <T>Update the branch-local value for this Locale.</T>
            </DialogDescription>
          </DialogHeader>
          <TranslationValueEditor
            key={`${message.lookupId}:${locale}:${open ? "open" : "closed"}`}
            locale={locale}
            message={message}
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TranslationValueEditor({ locale, message, onSaved }: { locale: string; message: MessageRow; onSaved: () => void }) {
  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const t = useT()
  const { queryClient } = Route.useRouteContext()
  const localeValue = getLocaleValue(message, locale)

  const saveMutation = useMutation({
    mutationFn: saveLocaleValueFn,
    onSuccess: () => {
      toast.success(t("Locale value saved"))
      void queryClient.invalidateQueries(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))
      onSaved()
    },
    onError: (error: Error) => toast.error(t("Could not save Locale value"), { description: error.message }),
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
    onSubmit: ({ value }) =>
      saveMutation.mutate({
        data: { branchName, locale, lookupId: message.lookupId, orgSlug, projectSlug, value: value.value },
      }),
  })

  return (
    <div className="flex flex-col gap-4 pt-2">
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
                label={formatLocale(locale, [locale])}
                description={t("Saved custom versions apply to this Branch.")}
                placeholder={t("Write the translation people should see")}
                rows={5}
              />
            )}
          </form.AppField>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form.SubmitButton size="lg" className="w-full sm:flex-1" disabled={saveMutation.isPending}>
              {(isSubmitting) =>
                isSubmitting || saveMutation.isPending ? (
                  <T>Saving...</T>
                ) : (
                  <>
                    <CheckIcon />
                    <T>Save value</T>
                  </>
                )
              }
            </form.SubmitButton>
          </div>
        </form>
      </form.AppForm>
    </div>
  )
}
