import { Button } from "@better-translation/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@better-translation/ui/components/dialog"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@better-translation/ui/components/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@better-translation/ui/components/select"
import { cn } from "@better-translation/ui/lib/utils"
import { useDebouncer } from "@tanstack/react-pacer"
import { BotIcon, BracesIcon, FileCodeIcon, InfoIcon, MessageSquareTextIcon, PencilIcon, SearchIcon } from "lucide-react"
import { useEffect, useMemo, useState, type SubmitEvent, type ReactNode } from "react"

const searchDebounceMs = 300

export type MessageEditorView = "all" | "needs-value" | "manual" | "ai"
export type MessageEditorMode = "local" | "remote"
export type MessageEditorLocaleValueSource = "default" | "imported" | "ai" | "manual"

export interface MessageEditorSource {
  file: string
  kind?: string | null
  marker?: string | null
}

export interface MessageEditorLocaleValue {
  value: string
  source: MessageEditorLocaleValueSource
  hasValue: boolean
  stale?: boolean
}

export interface MessageEditorMessageSummary {
  id: string
  lookupId: string
  defaultMessage: string
  placeholders: string[]
  done: number
  total: number
}

export interface MessageEditorMessage extends MessageEditorMessageSummary {
  context?: string | null
  localeValues: Record<string, MessageEditorLocaleValue>
  sources: MessageEditorSource[]
}

export interface MessageEditorConfig {
  appLocale: string
  defaultLocale: string
  locales: string[]
}

export interface MessageInboxLabels {
  aiGenerated: string
  all: string
  cancel: string
  close: string
  context: string
  couldNotSaveLocaleValue: string
  default: string
  defaultMessage: string
  editLocaleValue: string
  edited: string
  generate: string
  generateLocaleValueDescription: string
  generateLocaleValueTitle: string
  generating: string
  hideMessageDetails: string
  imported: string
  includePlaceholders: string
  localeValueIsRequired: string
  localeValuesProgress: (done: number, total: number) => string
  more: (count: number) => string
  needsValue: string
  needsValueWithCount: (count: number) => string
  noMessagesMatch: string
  noValueYet: string
  original: string
  outdated: string
  placeholders: string
  saveValue: string
  saving: string
  searchMessages: string
  searchPlaceholder: string
  selectMessage: string
  show: string
  showMessageDetails: string
  sources: string
  writeLocaleValuePlaceholder: string
}

export interface MessageInboxProps {
  mode: MessageEditorMode
  config: MessageEditorConfig
  messages: MessageEditorMessageSummary[]
  selectedMessage?: MessageEditorMessage | null
  selectedMessageId?: string
  search: string
  view: MessageEditorView
  incompleteCount: number
  isMessagesLoading?: boolean
  isSelectedMessageLoading?: boolean
  error?: string
  labels?: Partial<MessageInboxLabels>
  onSearchChange: (value: string) => void
  onViewChange: (value: MessageEditorView) => void
  onSelectMessage: (messageId: string) => void
  onPrefetchMessage?: (messageId: string) => void
  onSaveLocaleValue: (input: { locale: string; lookupId: string; value: string }) => Promise<void> | void
  onGenerateLocaleValue?: (input: { locale: string; lookupId: string }) => Promise<void> | void
}

export function MessageInbox({
  mode,
  config,
  messages,
  selectedMessage,
  selectedMessageId,
  search,
  view,
  incompleteCount,
  isMessagesLoading,
  isSelectedMessageLoading,
  error,
  labels: providedLabels,
  onSearchChange,
  onViewChange,
  onSelectMessage,
  onPrefetchMessage,
  onSaveLocaleValue,
  onGenerateLocaleValue,
}: MessageInboxProps) {
  const labels = useMemo(() => ({ ...defaultMessageInboxLabels, ...providedLabels }), [providedLabels])
  const [searchInput, setSearchInput] = useState(search)
  const searchDebouncer = useDebouncer((value: string) => onSearchChange(value), { wait: searchDebounceMs })

  useEffect(() => setSearchInput(search), [search])

  return (
    <div className="grid h-[min(760px,calc(100dvh-8rem))] min-h-[560px] overflow-hidden rounded-lg border bg-background md:grid-cols-[24rem_1fr]">
      <div className="flex min-h-0 flex-col border-r">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{labels.searchMessages}</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                searchDebouncer.maybeExecute(event.target.value)
              }}
              placeholder={labels.searchPlaceholder}
            />
          </label>
          <MessageViewSelect
            incompleteCount={incompleteCount}
            labels={labels}
            mode={mode}
            value={view}
            onValueChange={onViewChange}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isMessagesLoading ? (
            <MessageListSkeleton />
          ) : messages.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{labels.noMessagesMatch}</p>
          ) : (
            messages.map((message) => (
              <button
                key={message.id}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-1 border-b px-3 py-2.5 text-left hover:bg-muted/50",
                  message.done < message.total && "bg-amber-500/5",
                  selectedMessageId === message.id && "bg-muted",
                )}
                onClick={() => onSelectMessage(message.id)}
                onMouseOver={() => onPrefetchMessage?.(message.id)}
              >
                <MessageText
                  value={message.defaultMessage}
                  placeholders={message.placeholders}
                  className="line-clamp-2 text-sm leading-5"
                />
                {message.done < message.total && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {labels.localeValuesProgress(message.done, message.total)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {isSelectedMessageLoading ? (
          <MessageDetailSkeleton />
        ) : error ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{error}</div>
        ) : selectedMessage ? (
          <MessageDetail
            mode={mode}
            config={config}
            labels={labels}
            message={selectedMessage}
            onGenerateLocaleValue={onGenerateLocaleValue}
            onSaveLocaleValue={onSaveLocaleValue}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{labels.selectMessage}</div>
        )}
      </div>
    </div>
  )
}

function MessageViewSelect({
  incompleteCount,
  labels,
  mode,
  value,
  onValueChange,
}: {
  incompleteCount: number
  labels: MessageInboxLabels
  mode: MessageEditorMode
  value: MessageEditorView
  onValueChange: (value: MessageEditorView) => void
}) {
  const items: Array<{ label: string; value: MessageEditorView }> = [{ label: labels.all, value: "all" }]

  if (incompleteCount > 0 || value === "needs-value") {
    items.push({ label: labels.needsValueWithCount(incompleteCount), value: "needs-value" })
  }

  if (mode === "remote") {
    items.push({ label: labels.edited, value: "manual" }, { label: labels.aiGenerated, value: "ai" })
  }

  if (items.length === 1) return null

  return (
    <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as MessageEditorView)}>
      <SelectTrigger className="w-full data-popup-open:bg-muted sm:w-44">
        <span className="text-muted-foreground">{labels.show}</span>
        <SelectValue>{items.find((item) => item.value === value)?.label ?? labels.all}</SelectValue>
      </SelectTrigger>
      <SelectContent sideOffset={4} align="end" alignItemWithTrigger={false} className="w-(--anchor-width) p-1">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MessageDetail({
  mode,
  config,
  labels,
  message,
  onGenerateLocaleValue,
  onSaveLocaleValue,
}: {
  mode: MessageEditorMode
  config: MessageEditorConfig
  labels: MessageInboxLabels
  message: MessageEditorMessage
  onGenerateLocaleValue?: (input: { locale: string; lookupId: string }) => Promise<void> | void
  onSaveLocaleValue: (input: { locale: string; lookupId: string; value: string }) => Promise<void> | void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const editableLocales = config.locales.filter((locale) => locale !== config.defaultLocale)
  const hasDetails = Boolean(message.context || getMessagePlaceholderTokens(message).length > 0 || message.sources.length > 0)

  useEffect(() => setDetailsOpen(false), [message.id])

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="rounded-md border bg-muted/30">
        <div className="flex h-10 items-center justify-between gap-2 border-b px-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {formatLocale(config.defaultLocale, config.appLocale)} ({labels.original})
          </p>
          {hasDetails && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={detailsOpen ? labels.hideMessageDetails : labels.showMessageDetails}
              aria-expanded={detailsOpen}
              aria-pressed={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <InfoIcon />
            </Button>
          )}
        </div>
        <div className="p-3">
          <MessageText value={message.defaultMessage} placeholders={message.placeholders} className="leading-6" />
        </div>
        {hasDetails && detailsOpen && <MessageSourceDetails labels={labels} message={message} />}
      </div>
      <div className="flex flex-col gap-4">
        {editableLocales.map((locale) => (
          <MessageLocaleRow
            key={locale}
            mode={mode}
            config={config}
            labels={labels}
            locale={locale}
            message={message}
            onGenerateLocaleValue={onGenerateLocaleValue}
            onSaveLocaleValue={onSaveLocaleValue}
          />
        ))}
      </div>
    </div>
  )
}

function MessageLocaleRow({
  mode,
  config,
  labels,
  locale,
  message,
  onGenerateLocaleValue,
  onSaveLocaleValue,
}: {
  mode: MessageEditorMode
  config: MessageEditorConfig
  labels: MessageInboxLabels
  locale: string
  message: MessageEditorMessage
  onGenerateLocaleValue?: (input: { locale: string; lookupId: string }) => Promise<void> | void
  onSaveLocaleValue: (input: { locale: string; lookupId: string; value: string }) => Promise<void> | void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const localeValue = message.localeValues[locale]
  const currentValue = localeValue?.value ?? message.defaultMessage
  const isMissing = !localeValue?.hasValue

  const handleGenerate = async () => {
    if (!onGenerateLocaleValue) return
    setIsGenerating(true)
    try {
      await onGenerateLocaleValue({ locale, lookupId: message.lookupId })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={cn("rounded-md border", isMissing && "border-amber-500/40 bg-amber-500/5")}>
      <div className="flex h-12 items-center justify-between gap-2 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-sm text-muted-foreground">{formatLocale(locale, config.appLocale)}</p>
          {mode === "remote" && (
            <LocaleValueSourceBadge
              missing={isMissing}
              labels={labels}
              source={localeValue?.source ?? "default"}
              stale={Boolean(localeValue?.stale)}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <TranslationValueDialog
            currentValue={currentValue}
            locale={locale}
            message={message}
            labels={labels}
            config={config}
            onSaveLocaleValue={onSaveLocaleValue}
          />
          {mode === "remote" && onGenerateLocaleValue && (
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="outline" size="icon-sm" disabled={isGenerating} />}>
                <BotIcon />
              </PopoverTrigger>
              <PopoverContent sideOffset={6} align="end" className="w-80 gap-3 border p-3">
                <div className="grid gap-1">
                  <PopoverTitle className="text-sm">{labels.generateLocaleValueTitle}</PopoverTitle>
                  <PopoverDescription className="text-sm">{labels.generateLocaleValueDescription}</PopoverDescription>
                </div>
                <div className="flex justify-end gap-2">
                  <PopoverClose render={<Button type="button" variant="outline" />}>{labels.cancel}</PopoverClose>
                  <Button type="button" disabled={isGenerating} onClick={() => void handleGenerate()}>
                    <BotIcon />
                    {isGenerating ? labels.generating : labels.generate}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <div className="p-3">
        {isMissing ? (
          <p className="leading-6 text-muted-foreground italic">{labels.noValueYet}</p>
        ) : (
          <MessageText value={currentValue} placeholders={message.placeholders} className="leading-6" />
        )}
      </div>
    </div>
  )
}

function TranslationValueDialog({
  currentValue,
  config,
  labels,
  locale,
  message,
  onSaveLocaleValue,
}: {
  currentValue: string
  config: MessageEditorConfig
  labels: MessageInboxLabels
  locale: string
  message: MessageEditorMessage
  onSaveLocaleValue: (input: { locale: string; lookupId: string; value: string }) => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon-sm" aria-label={labels.editLocaleValue} />}>
        <PencilIcon />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <TranslationValueForm
          currentValue={currentValue}
          config={config}
          labels={labels}
          locale={locale}
          message={message}
          onClose={() => setOpen(false)}
          onSaveLocaleValue={onSaveLocaleValue}
        />
      </DialogContent>
    </Dialog>
  )
}

function TranslationValueForm({
  currentValue,
  config,
  labels,
  locale,
  message,
  onClose,
  onSaveLocaleValue,
}: {
  currentValue: string
  config: MessageEditorConfig
  labels: MessageInboxLabels
  locale: string
  message: MessageEditorMessage
  onClose: () => void
  onSaveLocaleValue: (input: { locale: string; lookupId: string; value: string }) => Promise<void> | void
}) {
  const [value, setValue] = useState(currentValue)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const nextValue = value.trim()
    if (!nextValue) {
      setError(labels.localeValueIsRequired)
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await onSaveLocaleValue({ locale, lookupId: message.lookupId, value: nextValue })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : labels.couldNotSaveLocaleValue)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle>{labels.editLocaleValue}</DialogTitle>
        <DialogDescription>{formatLocale(locale, config.appLocale)}</DialogDescription>
      </DialogHeader>
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{labels.defaultMessage}</p>
        <MessageText value={message.defaultMessage} placeholders={message.placeholders} className="leading-6" />
      </div>
      <TranslationValueEditorGuidance labels={labels} message={message} />
      <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="grid gap-2">
          <span className="text-sm font-medium">{formatLocale(locale, config.appLocale)}</span>
          <textarea
            className="min-h-32 resize-y rounded-lg border border-input bg-transparent p-3 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            rows={5}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={labels.writeLocaleValuePlaceholder}
          />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-9 w-full" disabled={isSaving}>
          {isSaving ? labels.saving : labels.saveValue}
        </Button>
      </form>
    </>
  )
}

function TranslationValueEditorGuidance({ labels, message }: { labels: MessageInboxLabels; message: MessageEditorMessage }) {
  const placeholders = getMessagePlaceholderTokens(message)
  if (!message.context && placeholders.length === 0) return null

  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm">
      {message.context && (
        <GuidanceItem icon={<MessageSquareTextIcon />} title={labels.context}>
          {message.context}
        </GuidanceItem>
      )}
      {placeholders.length > 0 && (
        <GuidanceItem icon={<BracesIcon />} title={labels.placeholders}>
          <p className="mt-1 text-muted-foreground">{labels.includePlaceholders}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {placeholders.map((placeholder) => (
              <PlaceholderLiteral key={placeholder} placeholder={placeholder} />
            ))}
          </div>
        </GuidanceItem>
      )}
    </div>
  )
}

function MessageSourceDetails({ labels, message }: { labels: MessageInboxLabels; message: MessageEditorMessage }) {
  const placeholders = getMessagePlaceholderTokens(message)

  return (
    <div className="flex flex-col gap-3 rounded-b-md border-t bg-background p-3 text-sm">
      {message.sources.length > 0 && (
        <GuidanceItem icon={<FileCodeIcon />} title={labels.sources}>
          <div className="mt-1 flex flex-col gap-1">
            {message.sources.slice(0, 3).map((source, index) => (
              <p key={`${source.file}:${source.kind}:${source.marker}:${index}`} className="font-mono text-xs break-all">
                {formatSourceLocation(source)}
              </p>
            ))}
            {message.sources.length > 3 && (
              <p className="text-xs text-muted-foreground">{labels.more(message.sources.length - 3)}</p>
            )}
          </div>
        </GuidanceItem>
      )}
      {message.context && (
        <GuidanceItem icon={<MessageSquareTextIcon />} title={labels.context}>
          {message.context}
        </GuidanceItem>
      )}
      {placeholders.length > 0 && (
        <GuidanceItem icon={<BracesIcon />} title={labels.placeholders}>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {placeholders.map((placeholder) => (
              <PlaceholderBadge key={placeholder} placeholder={placeholder} />
            ))}
          </div>
        </GuidanceItem>
      )}
    </div>
  )
}

function GuidanceItem({
  children,
  className,
  icon,
  title,
}: {
  children: ReactNode
  className?: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className={cn("flex min-w-0 gap-2", className)}>
      <span className="mt-0.5 size-4 shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="mt-1 text-pretty">{children}</div>
      </div>
    </div>
  )
}

function LocaleValueSourceBadge({
  labels,
  missing,
  source,
  stale,
}: {
  labels: MessageInboxLabels
  missing?: boolean
  source: MessageEditorLocaleValueSource
  stale?: boolean
}) {
  if (missing)
    return (
      <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
        {labels.needsValue}
      </span>
    )
  if (stale)
    return (
      <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
        {labels.outdated}
      </span>
    )

  const label =
    source === "ai"
      ? labels.aiGenerated
      : source === "manual"
        ? labels.edited
        : source === "imported"
          ? labels.imported
          : labels.default
  return <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{label}</span>
}

function MessageText({ className, placeholders, value }: { className?: string; placeholders: string[]; value: string }) {
  const placeholderSet = useMemo(() => new Set(placeholders), [placeholders])
  const nodes = getMessageTextNodes(value, placeholderSet)

  return (
    <p className={cn("text-sm", className)}>
      <MessageTextNodes nodes={nodes} />
    </p>
  )
}

type MessageTextNode =
  | string
  | { placeholder: string; type: "placeholder" }
  | { children: MessageTextNode[]; index: string; kind: "paired" | "self-closing"; type: "rich-text" }

function MessageTextNodes({ nodes }: { nodes: MessageTextNode[] }) {
  return nodes.map((node, index) => {
    if (typeof node === "string") return node
    if (node.type === "placeholder") {
      return <PlaceholderBadge key={`${node.placeholder}:${index}`} placeholder={node.placeholder} />
    }
    if (node.kind === "self-closing") return null
    return <MessageTextNodes key={`${node.index}:${index}`} nodes={node.children} />
  })
}

function PlaceholderBadge({ placeholder }: { placeholder: string }) {
  return (
    <span className="inline align-baseline font-mono text-sm leading-[inherit] font-semibold tracking-tight text-olive-500 underline decoration-olive-300 decoration-1 underline-offset-3 dark:text-olive-400 dark:decoration-olive-600">
      {formatPlaceholderLabel(placeholder)}
    </span>
  )
}

function PlaceholderLiteral({ placeholder }: { placeholder: string }) {
  return (
    <code className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-xs">
      {placeholder.startsWith("<") ? placeholder : `{${placeholder}}`}
    </code>
  )
}

function MessageListSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="grid gap-2 border-b p-3">
          <div className="h-3 w-11/12 rounded-full bg-muted" />
          <div className="h-3 w-5/12 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  )
}

function MessageDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="rounded-md border bg-muted/30">
        <div className="flex h-10 items-center justify-between gap-2 border-b px-3">
          <div className="h-3 w-32 rounded-full bg-muted" />
          <div className="size-8 rounded-md border bg-muted" />
        </div>
        <div className="space-y-2 p-3">
          <div className="h-4 w-11/12 rounded-full bg-muted" />
          <div className="h-4 w-7/12 rounded-full bg-muted" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-md border">
          <div className="flex h-12 items-center justify-between gap-2 border-b px-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-3 w-24 rounded-full bg-muted" />
              <div className="h-6 w-28 rounded-full border bg-muted" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-md border bg-muted" />
              <div className="size-8 rounded-md border bg-muted" />
            </div>
          </div>
          <div className="space-y-2 p-3">
            <div className="h-4 w-full rounded-full bg-muted" />
            <div className="h-4 w-8/12 rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function getMessageTextNodes(value: string, placeholders: Set<string>) {
  const nodes: MessageTextNode[] = []
  const stack: Array<{ children: MessageTextNode[]; index: string; opening: string }> = []
  const matcher = /\{([A-Za-z_$][\w$]*)\}|<(\d+)\/>|<(\d+)>|<\/(\d+)>/g
  let lastIndex = 0
  for (const match of value.matchAll(matcher)) {
    const currentNodes = stack.at(-1)?.children ?? nodes
    if (match.index > lastIndex) pushMessageTextNode(currentNodes, value.slice(lastIndex, match.index))

    const placeholder = match[1]
    const selfClosingIndex = match[2]
    const openingIndex = match[3]
    const closingIndex = match[4]
    if (placeholder) {
      pushMessageTextNode(currentNodes, placeholders.has(placeholder) ? { placeholder, type: "placeholder" } : match[0])
    } else if (selfClosingIndex) {
      currentNodes.push({ children: [], index: selfClosingIndex, kind: "self-closing", type: "rich-text" })
    } else if (openingIndex) {
      stack.push({ children: [], index: openingIndex, opening: match[0] })
    } else if (closingIndex && stack.at(-1)?.index === closingIndex) {
      const richText = stack.pop()
      if (richText) {
        const currentNodes = stack.at(-1)?.children ?? nodes
        currentNodes.push({
          children: richText.children,
          index: richText.index,
          kind: "paired",
          type: "rich-text",
        })
      }
    } else {
      currentNodes.push({ placeholder: match[0], type: "placeholder" })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < value.length) pushMessageTextNode(stack.at(-1)?.children ?? nodes, value.slice(lastIndex))

  while (stack.length > 0) {
    const richText = stack.pop()
    if (!richText) continue
    const currentNodes = stack.at(-1)?.children ?? nodes
    currentNodes.push({ placeholder: richText.opening, type: "placeholder" }, ...richText.children)
  }

  return nodes.length > 0 ? nodes : [value]
}

function pushMessageTextNode(nodes: MessageTextNode[], node: MessageTextNode) {
  if (node === "") return
  const previous = nodes[nodes.length - 1]
  if (typeof previous === "string" && typeof node === "string") nodes[nodes.length - 1] = previous + node
  else nodes.push(node)
}

function getMessagePlaceholderTokens(message: Pick<MessageEditorMessage, "defaultMessage" | "placeholders">) {
  return [...new Set([...message.placeholders, ...getRichTextPlaceholderTokens(message.defaultMessage)])]
}

function getRichTextPlaceholderTokens(value: string) {
  const placeholders: string[] = []

  const visit = (nodes: MessageTextNode[]) => {
    for (const node of nodes) {
      if (typeof node === "string") continue
      if (node.type === "placeholder") {
        if (node.placeholder.startsWith("<")) placeholders.push(node.placeholder)
        continue
      }
      placeholders.push(node.kind === "paired" ? `<${node.index}>…</${node.index}>` : `<${node.index}/>`)
      visit(node.children)
    }
  }

  visit(getMessageTextNodes(value, new Set()))
  return [...new Set(placeholders)]
}

function formatPlaceholderLabel(placeholder: string) {
  if (placeholder.startsWith("<")) return placeholder
  return placeholder
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function formatSourceLocation(source: MessageEditorSource) {
  return [source.file, source.kind, source.marker].filter(Boolean).join(" · ")
}

function formatLocale(locale: string, appLocale: string) {
  try {
    return new Intl.DisplayNames([appLocale], { type: "language" }).of(locale) ?? locale
  } catch {
    return locale
  }
}

const defaultMessageInboxLabels: MessageInboxLabels = {
  aiGenerated: "AI generated",
  all: "All",
  cancel: "Cancel",
  close: "Close",
  context: "Context",
  couldNotSaveLocaleValue: "Could not save Locale value.",
  default: "Default",
  defaultMessage: "Default Message",
  editLocaleValue: "Edit Locale value",
  edited: "Edited",
  generate: "Generate",
  generateLocaleValueDescription: "Better Translation will generate and save a Locale value for this Message.",
  generateLocaleValueTitle: "Generate this Locale value?",
  generating: "Generating...",
  hideMessageDetails: "Hide Message details",
  imported: "Imported",
  includePlaceholders: "Include these placeholders in the Locale value.",
  localeValueIsRequired: "Locale value is required.",
  localeValuesProgress: (done, total) => `${done} of ${total} Locale values`,
  more: (count) => `+${count} more`,
  needsValue: "Needs value",
  needsValueWithCount: (count) => `Needs value (${count})`,
  noMessagesMatch: "No Messages match.",
  noValueYet: "No value yet",
  original: "Original",
  outdated: "Outdated",
  placeholders: "Placeholders",
  saveValue: "Save value",
  saving: "Saving...",
  searchMessages: "Search Messages",
  searchPlaceholder: "Search ...",
  selectMessage: "Select a Message",
  show: "Show",
  showMessageDetails: "Show Message details",
  sources: "Sources",
  writeLocaleValuePlaceholder: "Write the Locale value people should see",
}
