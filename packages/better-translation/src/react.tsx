import { Children, createContext, isValidElement, useContext, useMemo, type ReactNode } from "react"

import type { TranslateOptions } from "./types.js"

import { getCallMessageId, getMessageId } from "./message-id.js"

interface TranslateContextValue {
  messages: Record<string, string>
}

const TranslateContext = createContext<TranslateContextValue>({ messages: {} })

/** Props for `TranslateProvider`. */
export interface TranslateProviderProps {
  /** Flattened locale message map keyed by stable message id. */
  messages: Record<string, string>
  /** React subtree that should have access to translations. */
  children: ReactNode
}

/** Provides translated messages to React components below it. */
export function TranslateProvider({ messages, children }: TranslateProviderProps) {
  const value = useMemo(() => ({ messages }), [messages])
  return <TranslateContext.Provider value={value}>{children}</TranslateContext.Provider>
}

/** Returns the raw locale message map from the current provider. */
export function useMessages() {
  return useContext(TranslateContext).messages
}

type MessageValues = Record<string, unknown>
type TranslateFn = (message: string, valuesOrOptions?: MessageValues | TranslateOptions, options?: TranslateOptions) => string

/** Returns a translator function for text used in props, labels, and other non-JSX positions. */
export function useT(): TranslateFn {
  const { messages } = useContext(TranslateContext)
  return useMemo<TranslateFn>(
    () => (message, valuesOrOptions, options) => {
      const values = isTranslateOptions(valuesOrOptions) ? undefined : normalizeValues(valuesOrOptions)
      const resolvedOptions = isTranslateOptions(valuesOrOptions) ? valuesOrOptions : options
      const template = messages[getCallMessageId(message, resolvedOptions)] ?? message
      if (!values) return template
      return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
    },
    [messages],
  )
}

/** Props for `Var`. */
export type VarProps = {
  /** Optional shorthand child form, normalized at build time for simple identifiers. */
  children?: ReactNode
} & Record<string, ReactNode | undefined>

/** Marks a runtime value for placeholder interpolation inside `<T>` content. */
export function Var(props: VarProps) {
  return <>{getRuntimeVarEntry(props)?.value ?? props.children}</>
}

/** Props for `T`. */
export interface TProps {
  /** Explicit stable id to use instead of hashing the rendered source text, whether provided manually or by a transform. */
  id?: string
  /** Extra disambiguating context for translators and custom grouping. */
  context?: string
  /** Source-language JSX content to translate. */
  children?: ReactNode
}

/** Renders translated JSX content and supports placeholders through `<Var>`. */
export function T({ id, context, children }: TProps) {
  const { messages } = useContext(TranslateContext)
  const resolvedMeta = context ? { context } : undefined
  const runtimeContent = useMemo(() => extractRuntimeContent(children), [children])
  const template = messages[id ?? (runtimeContent.message ? getMessageId(runtimeContent.message, resolvedMeta) : "")]
  const vars = template?.includes("{") ? runtimeContent.vars : undefined
  const interpolated = useMemo(() => interpolate(template, vars), [template, vars])

  if (!template) return <>{children}</>
  if (!vars) return <>{template}</>
  if (!interpolated.length) return <>{children}</>
  return <>{interpolated}</>
}

function interpolate(template?: string, vars?: Record<string, ReactNode>): ReactNode[] {
  if (!template || !vars) return []
  const result: ReactNode[] = []
  const re = /\{(\w+)\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(template)) !== null) {
    if (match.index > lastIndex) result.push(template.slice(lastIndex, match.index))
    result.push(vars[match[1]!] ?? `{${match[1]}}`)
    lastIndex = re.lastIndex
  }

  if (lastIndex < template.length) result.push(template.slice(lastIndex))
  return result
}

function extractRuntimeContent(children: ReactNode) {
  const parts: string[] = []
  const vars: Record<string, ReactNode> = {}

  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      parts.push(String(child))
      return
    }

    if (isValidElement<VarProps>(child) && child.type === Var) {
      const entry = getRuntimeVarEntry(child.props)
      if (entry) {
        parts.push(`{${entry.name}}`)
        vars[entry.name] = entry.value
      }
    }
  })

  return {
    message: parts.join("").replace(/\s+/g, " ").trim(),
    vars: Object.keys(vars).length > 0 ? vars : undefined,
  }
}

function getRuntimeVarEntry(props: VarProps) {
  if (typeof props.name === "string" && props.children !== undefined) {
    return { name: props.name, value: props.children }
  }

  const entries = Object.entries(props).filter(([key]) => key !== "children")
  if (entries.length !== 1) return undefined

  const [name, value] = entries[0]!
  return { name, value }
}

function isTranslateOptions(value?: MessageValues | TranslateOptions): value is TranslateOptions {
  if (!value || Array.isArray(value)) return false
  return Object.keys(value).every((key) => key === "id" || key === "context")
}

function normalizeValues(values?: MessageValues) {
  if (!values) return undefined
  const entries = Object.entries(values).map(([name, value]) => [name, String(value)] as const)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
