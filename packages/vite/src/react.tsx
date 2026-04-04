import { Children, createContext, isValidElement, useContext, useMemo, type ReactNode } from "react"

import type { TranslateOptions } from "./types.js"

import { getCallMessageId, getMessageId } from "./message-id.js"

interface I18nContextValue {
  messages: Record<string, string>
}

const I18nContext = createContext<I18nContextValue>({ messages: {} })

/** Props for `I18nProvider`. */
export interface I18nProviderProps {
  /** Flattened locale message map keyed by stable message id. */
  messages: Record<string, string>
  /** React subtree that should have access to translations. */
  children: ReactNode
}

/** Provides translated messages to React components below it. */
export function I18nProvider({ messages, children }: I18nProviderProps) {
  const value = useMemo(() => ({ messages }), [messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Returns the raw locale message map from the current provider. */
export function useMessages() {
  return useContext(I18nContext).messages
}

type TranslateFn = (id: string, options?: TranslateOptions) => string

/** Returns a translator function for text used in props, labels, and other non-JSX positions. */
export function useT(): (id: string, options?: TranslateOptions) => string {
  const { messages } = useContext(I18nContext)
  return useMemo<TranslateFn>(() => (id, options) => messages[getCallMessageId(id, options)] ?? id, [messages])
}

/** Props for `Var`. */
export interface VarProps {
  /** Placeholder name used inside the parent translation template. */
  name: string
  /** Runtime value that should replace the placeholder. */
  children: ReactNode
}

/** Marks a runtime value for placeholder interpolation inside `<T>` content. */
export function Var({ children }: VarProps) {
  return <>{children}</>
}

/** Props for `T`. */
export interface TProps {
  /** Explicit stable id to use instead of hashing the rendered source text. */
  id?: string
  /** Extra disambiguating context for translators and custom grouping. */
  context?: string
  /** Source-language JSX content to translate. */
  children?: ReactNode
}

/** Renders translated JSX content and supports placeholders through `<Var>`. */
export function T({ id, context, children }: TProps) {
  const { messages } = useContext(I18nContext)
  const resolvedMeta = context ? { context } : undefined
  const fallbackExtraction = useMemo(() => (id ? undefined : extractRuntimeMessage(children)), [children, id])
  const template = messages[id ?? (fallbackExtraction?.message ? getMessageId(fallbackExtraction.message, resolvedMeta) : "")]
  const vars = useMemo(() => (template?.includes("{") ? extractRuntimeVars(children) : undefined), [children, template])
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

function extractRuntimeMessage(children: ReactNode) {
  const parts: string[] = []
  const vars = extractRuntimeVars(children)

  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      parts.push(String(child))
      return
    }

    if (isValidElement<{ name: string }>(child) && child.type === Var) parts.push(`{${child.props.name}}`)
  })

  return { message: parts.join("").replace(/\s+/g, " ").trim(), vars }
}

function extractRuntimeVars(children: ReactNode) {
  const vars: Record<string, ReactNode> = {}

  Children.forEach(children, (child) => {
    if (isValidElement<{ name: string; children: ReactNode }>(child) && child.type === Var) {
      vars[child.props.name] = child.props.children
    }
  })

  return Object.keys(vars).length > 0 ? vars : undefined
}
