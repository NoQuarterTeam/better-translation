import { useDebouncer } from "@tanstack/react-pacer"
import { keepPreviousData, useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  BotIcon,
  BracesIcon,
  CheckIcon,
  FileCodeIcon,
  InfoIcon,
  KeyRoundIcon,
  LanguagesIcon,
  MessageSquareTextIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { useAppForm } from "@/components/react-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatLocale } from "@/lib/locales"
import { cn } from "@/lib/utils"

import { BranchSwitcherSlot } from "./-components/branch-switcher"
import {
  branchMessageDetailQueryOptions,
  branchMessagesQueryOptions,
  branchWorkspaceQueryOptions,
  currentBranchSwitcherQueryOptions,
  saveLocaleValueFn,
  translateLocaleValueFn,
  type getBranchMessageDetailFn,
} from "./-data"
import { messageViewSchema, type MessageView } from "./-schema"

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug/$branchName/")({
  staticData: {
    appShell: {
      topBar: { BranchSwitcher: BranchSwitcherSlot },
    },
  },
  validateSearch: z.object({
    messageId: z.string().trim().min(1).optional().catch(undefined),
    q: z.string().trim().optional().catch(undefined),
    view: messageViewSchema.optional().catch(undefined),
  }),
  component: BranchPage,
  notFoundComponent: BranchNotFound,
  loader: async ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      currentBranchSwitcherQueryOptions(params.orgSlug, params.projectSlug, params.branchName),
    )
    return await context.queryClient.ensureQueryData(
      branchWorkspaceQueryOptions(params.orgSlug, params.projectSlug, params.branchName),
    )
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Messages")} · Better Translation` }] }
  },
})

type BranchMessageDetail = Awaited<ReturnType<typeof getBranchMessageDetailFn>>
type MessageRow = BranchMessageDetail["message"]
type LocaleValueSource = "default" | "imported" | "ai" | "manual"

function getLocaleValue(message: MessageRow, locale: string) {
  return message.localeValues[locale]
}

function BranchPage() {
  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const branchWorkspaceQuery = useSuspenseQuery(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {branchWorkspaceQuery.data.messageCount === 0 ? <MessagesEmptyState /> : <MessagesInbox />}
    </div>
  )
}

function MessagesInbox() {
  const t = useT()
  const navigate = Route.useNavigate()
  const searchParams = Route.useSearch()
  const { locale: appLocale, queryClient } = Route.useRouteContext()

  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const branchWorkspaceQuery = useSuspenseQuery(branchWorkspaceQueryOptions(orgSlug, projectSlug, branchName))
  const view = searchParams.view ?? "all"
  const branchMessagesQuery = useQuery({
    ...branchMessagesQueryOptions(orgSlug, projectSlug, branchName, { q: searchParams.q, view }),
    placeholderData: keepPreviousData,
  })
  const data = branchMessagesQuery.data
  const isLoading = branchMessagesQuery.isPending
  const [searchTerm, setSearchTerm] = useState(searchParams.q ?? "")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchParams.q ?? "")
  const debouncer = useDebouncer((value: string) => setDebouncedSearchTerm(value), { wait: 300 })

  const handleSetSearchTerm = useCallback(
    (value: string) => {
      setSearchTerm(value)
      debouncer.maybeExecute(value)
    },
    [debouncer],
  )

  useEffect(() => {
    const nextSearchTerm = searchParams.q ?? ""
    setSearchTerm(nextSearchTerm)
    setDebouncedSearchTerm(nextSearchTerm)
  }, [searchParams.q])

  useEffect(() => {
    if (debouncedSearchTerm === (searchParams.q ?? "")) return
    void navigate({ search: (current) => ({ ...current, q: debouncedSearchTerm || undefined }) })
  }, [debouncedSearchTerm, navigate, searchParams.q])

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid h-[calc(100dvh-8rem)] grid-cols-1 md:grid-cols-[24rem_1fr]">
        <div className="flex min-h-0 flex-col border-r">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
            <InputGroup className="min-w-0">
              <InputGroupInput
                value={searchTerm}
                onChange={(event) => handleSetSearchTerm(event.target.value)}
                placeholder={t("Search ...")}
              />
              <InputGroupAddon align="inline-start">
                <SearchIcon className="text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
            <MessageViewSelect
              incompleteCount={data?.incompleteCount ?? 0}
              value={searchParams.view ?? "all"}
              onValueChange={(view) =>
                void navigate({ search: (current) => ({ ...current, view: view === "all" ? undefined : view }) })
              }
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && <MessageListSkeleton />}
            {data?.messages.map((message) => {
              const isActive = searchParams?.messageId === message.id
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => void navigate({ search: (current) => ({ ...current, messageId: message.id }) })}
                  onMouseOver={() =>
                    void queryClient.prefetchQuery(branchMessageDetailQueryOptions(orgSlug, projectSlug, branchName, message.id))
                  }
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-1 border-b px-3 py-2.5 text-left hover:bg-muted/50",
                    message.done < message.total && "bg-amber-500/5",
                    isActive && "bg-muted",
                  )}
                >
                  <MessageText
                    value={message.defaultMessage}
                    placeholders={message.placeholders}
                    className="line-clamp-2 text-sm leading-5"
                  />
                  {message.done < message.total && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {t("{done} of {total} Locale values", { done: String(message.done), total: String(message.total) })}
                    </span>
                  )}
                </button>
              )
            })}
            {data?.messages.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                <T>No messages match.</T>
              </p>
            )}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto">
          {isLoading ? (
            <MessageDetailSkeleton />
          ) : searchParams?.messageId ? (
            <MessageLocaleDetailLoader appLocale={appLocale} isProduction={branchWorkspaceQuery.data.isProduction} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <T>Select a message</T>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function MessagesEmptyState() {
  return (
    <div className="flex h-[calc(100dvh-12rem)] items-center justify-center">
      <Empty>
        <EmptyHeader className="max-w-full text-left">
          <EmptyMedia variant="icon">
            <LanguagesIcon />
          </EmptyMedia>
          <EmptyTitle>
            <T>No Messages on this Branch yet</T>
          </EmptyTitle>
          <EmptyDescription className="max-w-xl">
            <T>
              Start the dev server with the Better Translation Vite plugin enabled. Plugin sync will upload the Manifest for this
              Branch, then Messages and Locale values will appear here.
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
        </EmptyContent>
      </Empty>
    </div>
  )
}

function MessageListSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 border-b px-3 py-3">
          <Skeleton className="h-4 w-full max-w-40" />
        </div>
      ))}
    </div>
  )
}

function MessageDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="rounded-md border bg-muted/30 p-3">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
          <Skeleton className="mt-4 h-5 w-full max-w-3xl" />
        </div>
      ))}
    </div>
  )
}

function MessageLocaleDetailLoader({ appLocale, isProduction }: { appLocale: string; isProduction: boolean }) {
  const t = useT()
  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const searchParams = Route.useSearch()
  const detailQuery = useQuery(branchMessageDetailQueryOptions(orgSlug, projectSlug, branchName, searchParams?.messageId || ""))
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => setDetailsOpen(false), [searchParams?.messageId])

  if (detailQuery.isPending) return <MessageDetailSkeleton />

  if (detailQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <T>Could not load Message.</T>
      </div>
    )
  }

  const editableLocales = detailQuery.data.branch.locales.filter((locale) => locale !== detailQuery.data.branch.defaultLocale)
  const hasDetails = hasMessageDetails(detailQuery.data.message)

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="rounded-md border bg-muted/30">
        <div className="flex h-10 items-center justify-between gap-2 border-b px-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {formatLocale(detailQuery.data.branch.defaultLocale, [appLocale])} ({<T>Original</T>})
          </p>
          {hasDetails && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={detailsOpen ? t("Hide Message details") : t("Show Message details")}
              aria-expanded={detailsOpen}
              aria-pressed={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <InfoIcon />
            </Button>
          )}
        </div>
        <div className="p-3">
          <MessageText
            value={detailQuery.data.message.defaultMessage}
            placeholders={detailQuery.data.message.placeholders}
            className="leading-6"
          />
        </div>
        {hasDetails && detailsOpen && <MessageSourceDetails message={detailQuery.data.message} />}
      </div>
      <div className="flex flex-col gap-4">
        {editableLocales.map((locale) => (
          <MessageLocaleRow
            key={locale}
            message={detailQuery.data.message}
            locale={locale}
            appLocale={appLocale}
            isProduction={isProduction}
          />
        ))}
      </div>
    </div>
  )
}

function MessageViewSelect({
  incompleteCount,
  value,
  disabled,
  onValueChange,
}: {
  incompleteCount: number
  value: MessageView
  disabled?: boolean
  onValueChange: (value: MessageView) => void
}) {
  const t = useT()
  const items: { label: string; value: MessageView }[] = [
    { label: t("All"), value: "all" },
    { label: t("Edited"), value: "manual" },
    { label: t("AI generated"), value: "ai" },
  ]

  if (incompleteCount > 0 || value === "needs-value") {
    items.splice(1, 0, { label: t("Needs value ({count})", { count: String(incompleteCount) }), value: "needs-value" })
  }

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(nextValue) => onValueChange(nextValue as MessageView)}
      aria-label={t("Show messages")}
      disabled={disabled}
    >
      <SelectTrigger size="default" className="w-full sm:w-44">
        <span className="text-muted-foreground">
          <T>Show</T>
        </span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function MessageLocaleRow({
  message,
  locale,
  appLocale,
  isProduction,
}: {
  message: MessageRow
  locale: string
  appLocale: string
  isProduction: boolean
}) {
  const t = useT()
  const { orgSlug, projectSlug, branchName } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const [editOpen, setEditOpen] = useState(false)
  const [translateOpen, setTranslateOpen] = useState(false)
  const localeValue = getLocaleValue(message, locale)
  const currentValue = localeValue?.value ?? message.defaultMessage
  const source: LocaleValueSource = localeValue?.source ?? "default"
  const isMissing = !localeValue?.hasOverride

  const translateMutation = useMutation({
    mutationFn: translateLocaleValueFn,
    onSuccess: () => {
      setTranslateOpen(false)
      toast.success(t("Platform translator saved a Locale value"))
      void queryClient.invalidateQueries({ queryKey: ["branch-messages", orgSlug, projectSlug, branchName] })
      void queryClient.invalidateQueries({ queryKey: ["branch-message-detail", orgSlug, projectSlug, branchName, message.id] })
    },
    onError: (error: Error) => toast.error(t("Could not translate Message"), { description: error.message }),
  })

  return (
    <div className={cn("rounded-md border", isMissing && "border-amber-500/40 bg-amber-500/5")}>
      <div className="flex h-12 items-center justify-between gap-2 border-b px-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{formatLocale(locale, [appLocale])}</p>
          <LocaleValueSourceBadge source={source} missing={isMissing} isProduction={isProduction} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("Edit Locale value")}
            onClick={() => setEditOpen(true)}
          >
            <PencilIcon className="size-3" />
          </Button>
          <Popover open={translateOpen} onOpenChange={setTranslateOpen}>
            <PopoverTrigger
              render={<Button type="button" variant="outline" size="icon-sm" />}
              aria-label={t("Use AI translation")}
              disabled={translateMutation.isPending}
            >
              <BotIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <PopoverHeader>
                <PopoverTitle>
                  <T>Translate this with AI?</T>
                </PopoverTitle>
                <PopoverDescription>
                  <T>
                    The Platform translator will generate and save a branch-local Locale value. This replaces the current value
                    for this Locale on this Branch.
                  </T>
                </PopoverDescription>
              </PopoverHeader>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTranslateOpen(false)}>
                  <T>Cancel</T>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={translateMutation.isPending}
                  onClick={() =>
                    translateMutation.mutate({ data: { branchName, locale, lookupId: message.lookupId, orgSlug, projectSlug } })
                  }
                >
                  <BotIcon />
                  {translateMutation.isPending ? <T>Translating...</T> : <T>Translate</T>}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="p-3">
        {isMissing ? (
          <p className="leading-6 text-muted-foreground italic">
            <T>No value yet</T>
          </p>
        ) : (
          <MessageText value={currentValue} placeholders={message.placeholders} className="leading-6" />
        )}
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <TranslationValueEditor
            key={`${message.lookupId}:${locale}:${editOpen ? "open" : "closed"}`}
            locale={locale}
            message={message}
            onSaved={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LocaleValueSourceBadge({
  source,
  missing,
  isProduction,
}: {
  source: LocaleValueSource
  missing?: boolean
  isProduction: boolean
}) {
  const t = useT()

  if (missing) {
    return (
      <Badge variant="outline" className="border-amber-500/40 font-normal text-amber-600 dark:text-amber-400">
        <T>Needs value</T>
      </Badge>
    )
  }

  if (source === "imported" && isProduction) return null

  const label =
    source === "ai"
      ? t("AI generated")
      : source === "manual"
        ? t("Edited")
        : source === "imported"
          ? t("From Production")
          : t("Default")

  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {label}
    </Badge>
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
      void queryClient.invalidateQueries({ queryKey: ["branch-messages", orgSlug, projectSlug, branchName] })
      void queryClient.invalidateQueries({ queryKey: ["branch-message-detail", orgSlug, projectSlug, branchName, message.id] })
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
      <DialogHeader className="pr-8">
        <DialogTitle>
          <T>Edit Locale value</T>
        </DialogTitle>
        <DialogDescription>{formatLocale(locale, [locale])}</DialogDescription>
      </DialogHeader>
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          <T>Default Message</T>
        </p>
        <MessageText value={message.defaultMessage} placeholders={message.placeholders} className="leading-6" />
      </div>
      <TranslationValueEditorGuidance message={message} />
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

function TranslationValueEditorGuidance({ message }: { message: MessageRow }) {
  if (!message.context && message.placeholders.length === 0) return null

  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm">
      {message.context && (
        <div className="flex min-w-0 gap-2">
          <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              <T>Context</T>
            </p>
            <p className="mt-1 text-pretty">{message.context}</p>
          </div>
        </div>
      )}

      {message.placeholders.length > 0 && (
        <div className="flex min-w-0 gap-2">
          <BracesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              <T>Placeholders</T>
            </p>
            <p className="mt-1 text-muted-foreground">
              <T>Include these placeholders in the Locale value.</T>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.placeholders.map((placeholder) => (
                <PlaceholderLiteral key={placeholder} placeholder={placeholder} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageSourceDetails({ message }: { message: MessageRow }) {
  const t = useT()

  return (
    <div className="grid gap-3 rounded-b-md border-t bg-background p-3 text-sm md:grid-cols-2">
      {message.context && (
        <div className="flex min-w-0 gap-2">
          <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              <T>Context</T>
            </p>
            <p className="mt-1 text-pretty">{message.context}</p>
          </div>
        </div>
      )}

      {message.placeholders.length > 0 && (
        <div className="flex min-w-0 gap-2">
          <BracesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              <T>Placeholders</T>
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {message.placeholders.map((placeholder) => (
                <PlaceholderBadge key={placeholder} placeholder={placeholder} />
              ))}
            </div>
          </div>
        </div>
      )}

      {message.sources.length > 0 && (
        <div className="flex min-w-0 gap-2">
          <FileCodeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              <T>Sources</T>
            </p>
            <div className="mt-1 flex flex-col gap-1">
              {message.sources.slice(0, 3).map((source, index) => (
                <div key={`${source.file}:${source.kind ?? ""}:${source.marker ?? ""}:${index}`} className="min-w-0">
                  <p className="font-mono text-xs break-all">{formatSourceLocation(source)}</p>
                </div>
              ))}
              {message.sources.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  {t("+{count} more", { count: String(message.sources.length - 3) })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function hasMessageDetails(message: MessageRow) {
  return Boolean(message.context || message.placeholders.length > 0 || message.sources.length > 0)
}

function MessageText({ value, placeholders, className }: { value: string; placeholders: string[]; className?: string }) {
  const placeholderSet = new Set(placeholders)
  const nodes = getMessageTextNodes(value, placeholderSet)

  return (
    <p className={cn("wrap-break-word", className)}>
      {nodes.map((node, index) =>
        typeof node === "string" ? (
          node
        ) : (
          <PlaceholderBadge key={`${node.placeholder}:${index}`} placeholder={node.placeholder} />
        ),
      )}
    </p>
  )
}

function getMessageTextNodes(value: string, placeholders: Set<string>): Array<string | { placeholder: string }> {
  if (placeholders.size === 0) return [value]

  const nodes: Array<string | { placeholder: string }> = []
  const regex = /\{([^{}]+)\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(value))) {
    const placeholder = match[1]
    if (!placeholder || !placeholders.has(placeholder)) continue

    if (match.index > lastIndex) pushMessageTextNode(nodes, value.slice(lastIndex, match.index))
    nodes.push({ placeholder })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < value.length) pushMessageTextNode(nodes, value.slice(lastIndex))
  return nodes.length > 0 ? nodes : [value]
}

function pushMessageTextNode(nodes: Array<string | { placeholder: string }>, text: string) {
  const previousNode = nodes.at(-1)
  nodes.push(typeof previousNode === "object" ? text.replace(/^\s+([,.;:!?])/, "$1") : text)
}

function PlaceholderBadge({ placeholder }: { placeholder: string }) {
  return (
    <span className="inline align-baseline font-mono text-sm leading-[inherit] font-semibold text-olive-500 underline decoration-olive-300 decoration-1 underline-offset-3 dark:text-olive-400 dark:decoration-olive-600">
      {formatPlaceholderLabel(placeholder)}
    </span>
  )
}

function PlaceholderLiteral({ placeholder }: { placeholder: string }) {
  return <code className="rounded-sm bg-background px-1.5 py-0.5 font-mono text-xs">{`{${placeholder}}`}</code>
}

function formatPlaceholderLabel(placeholder: string) {
  return placeholder
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function formatSourceLocation(source: MessageRow["sources"][number]) {
  if (source.kind && source.marker) return `${source.file} (${source.kind}:${source.marker})`
  return source.file
}

function BranchNotFound() {
  const { orgSlug, projectSlug } = Route.useParams()

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center bg-linear-to-b from-background via-background to-muted/30 px-4 py-10">
      <Card className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-background shadow-none ring-0">
        <CardContent className="space-y-4 py-2">
          <div>
            <p className="text-lg font-semibold tracking-[0.24em] text-muted-foreground uppercase">404</p>
            <h1 className="bg-linear-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-4xl font-semibold tracking-tight text-balance text-transparent">
              <T>Branch not found</T>
            </h1>
            <p className="text-sm text-pretty text-muted-foreground sm:text-base">
              <T>
                This Branch is not active on this Project. It may have been archived by Branch cleanup, or the URL may point to a
                Branch that has not synced a Manifest yet.
              </T>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link to="/app/$orgSlug/$projectSlug" params={{ orgSlug, projectSlug }} />}
            >
              Back to Project
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link to="/app/$orgSlug/$projectSlug/branches" params={{ orgSlug, projectSlug }} />}
            >
              View all Branches
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/80">
            Archived Branches are kept for runtime reads, but hidden from the active dashboard workflow.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
