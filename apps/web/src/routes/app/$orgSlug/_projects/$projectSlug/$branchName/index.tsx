import {
  MessageInbox as MessageInboxSurface,
  type MessageEditorMessage,
  type MessageInboxLabels,
} from "@better-translation/locale-editor"
import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent } from "@better-translation/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@better-translation/ui/components/empty"
import { keepPreviousData, useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { KeyRoundIcon, LanguagesIcon, TerminalIcon } from "lucide-react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/runtime"

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
import { messageViewSchema } from "./-schema"

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
  const detailQuery = useQuery({
    ...branchMessageDetailQueryOptions(orgSlug, projectSlug, branchName, searchParams.messageId || ""),
    enabled: Boolean(searchParams.messageId),
  })
  const data = branchMessagesQuery.data
  const saveMutation = useMutation({
    mutationFn: saveLocaleValueFn,
    onSuccess: () => {
      toast.success(t("Locale value saved"))
      void queryClient.invalidateQueries({ queryKey: ["branch-messages", orgSlug, projectSlug, branchName] })
      if (searchParams.messageId) {
        void queryClient.invalidateQueries({
          queryKey: ["branch-message-detail", orgSlug, projectSlug, branchName, searchParams.messageId],
        })
      }
    },
    onError: (error: Error) => toast.error(t("Could not save Locale value"), { description: error.message }),
  })
  const translateMutation = useMutation({
    mutationFn: translateLocaleValueFn,
    onSuccess: () => {
      toast.success(t("Locale value generated"))
      void queryClient.invalidateQueries({ queryKey: ["branch-messages", orgSlug, projectSlug, branchName] })
      if (searchParams.messageId) {
        void queryClient.invalidateQueries({
          queryKey: ["branch-message-detail", orgSlug, projectSlug, branchName, searchParams.messageId],
        })
      }
    },
    onError: (error: Error) => toast.error(t("Could not generate Locale value"), { description: error.message }),
  })
  const labels = {
    aiGenerated: t("AI generated"),
    all: t("All"),
    cancel: t("Cancel"),
    close: t("Close"),
    context: t("Context"),
    couldNotSaveLocaleValue: t("Could not save Locale value"),
    default: t("Default"),
    defaultMessage: t("Default Message"),
    editLocaleValue: t("Edit Locale value"),
    edited: t("Edited"),
    generate: t("Generate"),
    generateLocaleValueDescription: t("Better Translation will generate and save a Locale value for this Message."),
    generateLocaleValueTitle: t("Generate this Locale value?"),
    generating: t("Generating..."),
    hideMessageDetails: t("Hide Message details"),
    imported: t("Imported"),
    includePlaceholders: t("Include these placeholders in the Locale value."),
    localeValueIsRequired: t("Locale value is required"),
    localeValuesProgress: (done, total) => t("{done} of {total} Locale values", { done: String(done), total: String(total) }),
    more: (count) => t("+{count} more", { count: String(count) }),
    needsValue: t("Needs value"),
    needsValueWithCount: (count) => t("Needs value ({count})", { count: String(count) }),
    noMessagesMatch: t("No Messages match."),
    noValueYet: t("No value yet"),
    original: t("Original"),
    outdated: t("Outdated"),
    placeholders: t("Placeholders"),
    saveValue: t("Save value"),
    saving: t("Saving..."),
    searchMessages: t("Search Messages"),
    searchPlaceholder: t("Search ..."),
    selectMessage: t("Select a Message"),
    show: t("Show"),
    showMessageDetails: t("Show Message details"),
    sources: t("Sources"),
    writeLocaleValuePlaceholder: t("Write the Locale value people should see"),
  } satisfies MessageInboxLabels

  return (
    <MessageInboxSurface
      mode="remote"
      config={{
        appLocale,
        defaultLocale: branchWorkspaceQuery.data.branch.defaultLocale,
        locales: branchWorkspaceQuery.data.branch.locales,
      }}
      labels={labels}
      messages={data?.messages ?? []}
      selectedMessage={detailQuery.data ? toEditorMessage(detailQuery.data.message) : null}
      selectedMessageId={searchParams.messageId}
      search={searchParams.q ?? ""}
      view={view}
      incompleteCount={data?.incompleteCount ?? 0}
      isMessagesLoading={branchMessagesQuery.isPending}
      isSelectedMessageLoading={Boolean(searchParams.messageId) && detailQuery.isPending}
      error={detailQuery.isError ? t("Could not load Message.") : undefined}
      onSearchChange={(value) => void navigate({ search: (current) => ({ ...current, q: value || undefined }) })}
      onViewChange={(view) => void navigate({ search: (current) => ({ ...current, view: view === "all" ? undefined : view }) })}
      onSelectMessage={(messageId) => void navigate({ search: (current) => ({ ...current, messageId }) })}
      onPrefetchMessage={(messageId) =>
        void queryClient.prefetchQuery(branchMessageDetailQueryOptions(orgSlug, projectSlug, branchName, messageId))
      }
      onSaveLocaleValue={async ({ locale, lookupId, value }) => {
        await saveMutation.mutateAsync({ data: { branchName, locale, lookupId, orgSlug, projectSlug, value } })
      }}
      onGenerateLocaleValue={async ({ locale, lookupId }) => {
        await translateMutation.mutateAsync({ data: { branchName, locale, lookupId, orgSlug, projectSlug } })
      }}
    />
  )
}

function toEditorMessage(message: MessageRow): MessageEditorMessage {
  return {
    context: message.context,
    defaultMessage: message.defaultMessage,
    done: Object.values(message.localeValues).filter((value) => value.hasOverride).length,
    id: message.id,
    localeValues: Object.fromEntries(
      Object.entries(message.localeValues).map(([locale, value]) => [
        locale,
        {
          hasValue: value.hasOverride,
          source: value.source,
          stale: value.stale,
          value: value.value,
        },
      ]),
    ),
    lookupId: message.lookupId,
    placeholders: message.placeholders,
    sources: message.sources,
    total: Object.keys(message.localeValues).length - 1,
  }
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
