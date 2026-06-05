import "@better-translation/locale-editor/styles.css"
import {
  MessageInbox,
  type MessageEditorMessage,
  type MessageEditorMessageSummary,
  type MessageEditorConfig,
  type MessageEditorView,
} from "@better-translation/locale-editor"
import { QueryClient, QueryClientProvider, keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { createRoot } from "react-dom/client"

const editorPath = getLocalEditorPath()
const queryClient = new QueryClient()
const messageDetailStaleTime = 30_000

function LocalEditorApp() {
  const queryClient = useQueryClient()
  const [selectedMessageId, setSelectedMessageId] = useState<string>()
  const [search, setSearch] = useState("")
  const [view, setView] = useState<MessageEditorView>("all")
  const messagesQuery = useQuery({
    queryKey: localEditorQueryKeys.messages({ search, view }),
    queryFn: () => getLocalEditorMessages({ search, view }),
    placeholderData: keepPreviousData,
  })
  const selectedMessageQuery = useQuery({
    queryKey: selectedMessageId ? localEditorQueryKeys.message(selectedMessageId) : localEditorQueryKeys.noMessage(),
    queryFn: () => getLocalEditorMessage(selectedMessageId!),
    enabled: Boolean(selectedMessageId),
    staleTime: messageDetailStaleTime,
  })
  const saveLocaleValue = useMutation({
    mutationFn: updateLocalEditorLocaleValue,
    onSuccess: async (message) => {
      queryClient.setQueryData(localEditorQueryKeys.message(message.lookupId), message)
      await queryClient.invalidateQueries({ queryKey: localEditorQueryKeys.messagesRoot() })
    },
  })

  const config = messagesQuery.data?.config ?? defaultConfig
  const messages = messagesQuery.data?.messages ?? []
  const incompleteCount = messagesQuery.data?.incompleteCount ?? 0
  const error = messagesQuery.error ?? selectedMessageQuery.error

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Better Translation</h1>
      </header>
      <MessageInbox
        mode="local"
        config={config}
        messages={messages}
        selectedMessage={selectedMessageQuery.data ?? null}
        selectedMessageId={selectedMessageId}
        search={search}
        view={view}
        incompleteCount={incompleteCount}
        isMessagesLoading={messagesQuery.isPending}
        isSelectedMessageLoading={Boolean(selectedMessageId) && selectedMessageQuery.isPending}
        error={error ? formatError(error) : undefined}
        onSearchChange={setSearch}
        onViewChange={setView}
        onSelectMessage={setSelectedMessageId}
        onPrefetchMessage={(messageId) =>
          void queryClient.prefetchQuery({
            queryKey: localEditorQueryKeys.message(messageId),
            queryFn: () => getLocalEditorMessage(messageId),
            staleTime: messageDetailStaleTime,
          })
        }
        onSaveLocaleValue={async (input) => {
          await saveLocaleValue.mutateAsync(input)
        }}
      />
    </main>
  )
}

const defaultConfig: MessageEditorConfig = { appLocale: "en", defaultLocale: "en", locales: [] }

type LocalEditorMessagesResponse = {
  config: MessageEditorConfig
  incompleteCount: number
  messages: MessageEditorMessageSummary[]
}

const localEditorQueryKeys = {
  messagesRoot: () => ["local-editor", "messages"] as const,
  messages: (input: { search: string; view: MessageEditorView }) => [...localEditorQueryKeys.messagesRoot(), input] as const,
  message: (messageId: string) => ["local-editor", "message", messageId] as const,
  noMessage: () => ["local-editor", "message", null] as const,
}

async function getLocalEditorMessages({ search, view }: { search: string; view: MessageEditorView }) {
  const params = new URLSearchParams()
  if (search) params.set("q", search)
  if (view !== "all") params.set("view", view)
  return readJson<LocalEditorMessagesResponse>(await fetch(getLocalEditorUrl(`/api/messages?${params.toString()}`)))
}

async function getLocalEditorMessage(messageId: string) {
  return readJson<MessageEditorMessage>(await fetch(getLocalEditorUrl(`/api/messages/${encodeURIComponent(messageId)}`)))
}

async function updateLocalEditorLocaleValue({ locale, lookupId, value }: { locale: string; lookupId: string; value: string }) {
  return readJson<MessageEditorMessage>(
    await fetch(getLocalEditorUrl(`/api/messages/${encodeURIComponent(lookupId)}/locales/${encodeURIComponent(locale)}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value }),
    }),
  )
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Request failed.")
  return data as T
}

function formatError(cause: unknown) {
  return cause instanceof Error ? cause.message : "Local editor request failed."
}

function getLocalEditorUrl(path: `/${string}`) {
  return `${editorPath}${path}`
}

function getLocalEditorPath() {
  const currentScript = document.currentScript
  if (currentScript instanceof HTMLScriptElement && currentScript.src) {
    return normalizeLocalEditorPath(new URL(currentScript.src).pathname.replace(/\/client\.js$/, ""))
  }

  return normalizeLocalEditorPath(window.location.pathname.replace(/\/index\.html$/, ""))
}

function normalizeLocalEditorPath(path: string) {
  const normalizedPath = path.replace(/\/+$/, "")
  return normalizedPath === "/" ? "" : normalizedPath
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <LocalEditorApp />
  </QueryClientProvider>,
)
