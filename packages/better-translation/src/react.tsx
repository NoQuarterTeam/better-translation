/**
 * React Translation markers and runtime helpers.
 *
 * @packageDocumentation
 */
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  use,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react"

import { getMessageId } from "./message/id.js"
import { isSupportedRichTextElement, isVoidRichTextElement } from "./message/rich-text.js"
import {
  getMessageStructure,
  hasSameRichTextStructure,
  parseRichTextMessage,
  type MessageStructure,
  type ParsedRichTextMessage,
  type RichTextMessageNode,
} from "./message/template.js"
import { getOwnValue } from "./message/value-record.js"
import { createT, type Translator } from "./runtime.js"
import { subscribeToLocaleValuesHotUpdates } from "./runtime/hot-locale-values.js"

interface TranslateContextValue {
  messages: Record<string, string>
}

const TranslateContext = createContext<TranslateContextValue>({ messages: {} })
const VAR_MARKER = Symbol.for("better-translation.Var")

/** Values accepted by {@link TranslateProvider}. */
export interface TranslateProviderProps {
  /** Active Locale used to apply development-time translation updates without reloading the page. */
  locale?: string
  /** Flat Runtime bundle for the active Locale, keyed by Lookup id. */
  messages: Record<string, string>
  /** React subtree that reads this Runtime bundle. */
  children: ReactNode
}

/**
 * Makes a loaded Runtime bundle available to Better Translation's React helpers.
 *
 * Place the provider above every component that uses {@link T}, {@link useT}, or
 * {@link useMessages}. Changing `messages` updates translators below the provider.
 * When `locale` is supplied, completed local development translations are applied
 * through Vite HMR without remounting the React subtree.
 */
export function TranslateProvider({ locale, messages, children }: TranslateProviderProps) {
  const [hotUpdate, setHotUpdate] = useState<{
    locale: string
    source: Record<string, string>
    messages: Record<string, string>
  }>()
  const resolvedMessages =
    hotUpdate && hotUpdate.locale === locale && hotUpdate.source === messages ? hotUpdate.messages : messages

  useEffect(() => {
    if (!locale) return
    return subscribeToLocaleValuesHotUpdates((update) => {
      if (update.locale !== locale) return
      setHotUpdate((current) => ({
        locale,
        source: messages,
        messages: {
          ...(current && current.locale === locale && current.source === messages ? current.messages : messages),
          ...update.messages,
        },
      }))
    })
  }, [locale, messages])

  const value = useMemo(() => ({ messages: resolvedMessages }), [resolvedMessages])
  return <TranslateContext.Provider value={value}>{children}</TranslateContext.Provider>
}

/**
 * Returns the Runtime bundle supplied by the nearest {@link TranslateProvider}.
 *
 * Returns an empty map when called outside a provider.
 */
export function useMessages() {
  return use(TranslateContext).messages
}

/**
 * Returns a memoized translator for Messages used in props, labels, and other
 * non-JSX positions.
 *
 * The returned function supports `{placeholder}` interpolation plus explicit
 * `id` and `context` options. It falls back to the authored Message when the
 * active Runtime bundle has no matching Locale value.
 *
 * @example
 * ```tsx
 * const t = useT()
 * const label = t("Invite {email}", { email }, { context: "Button label" })
 * ```
 */
export function useT(): Translator {
  const { messages } = use(TranslateContext)
  return useMemo(() => createT(messages), [messages])
}

/** Values accepted by {@link Var}. */
export type VarProps = {
  /** Runtime value used by the explicit `name` form, such as `<Var name="count">{count}</Var>`. */
  children?: ReactNode
} & Record<string, ReactNode | undefined>

/**
 * Marks a runtime value for placeholder interpolation inside {@link T}.
 *
 * A single named prop is the concise form: `<Var count={count} />`. Use
 * `<Var name="count" value={count} />` or children when an explicit placeholder
 * name is clearer. `Var` values can be any `ReactNode`; they are inserted as
 * authored values and are never parsed as translated HTML.
 */
export function Var(props: VarProps) {
  const entry = getRuntimeVarEntry(props)
  return <>{entry ? entry.value : props.children}</>
}

Object.defineProperty(Var, VAR_MARKER, { value: true })

/** Values accepted by {@link T}. */
export interface TProps {
  /** Explicit Lookup id to use instead of the stable id generated from the Message and context. */
  id?: string
  /** Disambiguating information for translators and otherwise-identical Messages with different meanings. */
  context?: string
  /** Authored JSX content that forms the Default locale Message. */
  children?: ReactNode
}

interface TransformedTProps extends TProps {
  message?: string
  values?: Record<string, ReactNode>
}

/**
 * Marks authored JSX as a Message and renders its active Locale value.
 *
 * Static supported inline elements such as `<strong>`, `<b>`, and `<i>`, plus
 * arbitrary source-owned React components, are represented as numbered
 * rich-text tags in the Message. At runtime `T` reuses the authored elements,
 * component implementations, and props; Locale values are never rendered as
 * arbitrary HTML. Nested elements are supported, and a Locale value with
 * invalid placeholder or rich-text structure safely falls back to the authored
 * children.
 *
 * Use {@link Var} for runtime values so translators can reorder placeholders
 * without changing the surrounding Message.
 */
export function T(props: TProps) {
  const { messages } = use(TranslateContext)
  const transformedProps = props as TransformedTProps

  return transformedProps.message === undefined ? (
    <RuntimeT {...transformedProps} messages={messages} />
  ) : (
    <CompiledT {...transformedProps} message={transformedProps.message} messages={messages} />
  )
}

function CompiledT({
  id,
  context,
  message,
  values,
  children,
  messages,
}: TransformedTProps & { message: string; messages: Record<string, string> }) {
  const resolvedMeta = context ? { context } : undefined
  const template = getOwnValue(messages, id ?? getMessageId(message, resolvedMeta))
  const shouldTranslate = Boolean(template && template !== message)
  const sourceStructure = useMemo(() => (shouldTranslate ? getMessageStructure(message) : undefined), [message, shouldTranslate])
  const translatedMessage = useMemo(
    () => (shouldTranslate && template ? parseRichTextMessage(template) : undefined),
    [shouldTranslate, template],
  )
  const needsRuntimeContent =
    shouldTranslate && sourceStructure !== undefined && sourceStructure.variables.size > 0 && values === undefined
  const needsRuntimeElements =
    shouldTranslate && sourceStructure !== undefined && sourceStructure.elements.size > 0 && !needsRuntimeContent
  const runtimeContent = useMemo(
    () => (needsRuntimeContent ? extractRuntimeContent(children) : undefined),
    [children, needsRuntimeContent],
  )
  const runtimeElements = useMemo(
    () => (needsRuntimeElements ? extractRuntimeElements(children) : []),
    [children, needsRuntimeElements],
  )
  const rendered = useMemo(() => {
    if (!shouldTranslate || !sourceStructure || !translatedMessage) return undefined
    if (runtimeContent) {
      return renderTemplate(sourceStructure, translatedMessage, runtimeContent.vars, runtimeContent.elements)
    }
    return runtimeElements ? renderTemplate(sourceStructure, translatedMessage, values, runtimeElements) : undefined
  }, [runtimeContent, runtimeElements, shouldTranslate, sourceStructure, translatedMessage, values])

  if (!shouldTranslate) return <>{children}</>
  if (!rendered) return <>{children}</>
  return <>{rendered}</>
}

function RuntimeT({ id, context, children, messages }: TProps & { messages: Record<string, string> }) {
  const resolvedMeta = context ? { context } : undefined
  const runtimeContent = useMemo(() => extractRuntimeContent(children), [children])
  const sourceMessage = runtimeContent?.message ?? ""
  const template = getOwnValue(messages, id ?? (sourceMessage ? getMessageId(sourceMessage, resolvedMeta) : ""))
  const shouldTranslate = Boolean(template && template !== sourceMessage)
  const sourceStructure = useMemo(
    () => (shouldTranslate ? getMessageStructure(sourceMessage) : undefined),
    [sourceMessage, shouldTranslate],
  )
  const translatedMessage = useMemo(
    () => (shouldTranslate && template ? parseRichTextMessage(template) : undefined),
    [shouldTranslate, template],
  )
  const rendered = useMemo(
    () =>
      shouldTranslate && runtimeContent && translatedMessage
        ? renderTemplate(sourceStructure, translatedMessage, runtimeContent.vars, runtimeContent.elements)
        : undefined,
    [sourceStructure, translatedMessage, runtimeContent, shouldTranslate],
  )

  if (!shouldTranslate) return <>{children}</>
  if (!rendered) return <>{children}</>
  return <>{rendered}</>
}

function renderTemplate(
  sourceStructure: MessageStructure | undefined,
  translatedMessage: ParsedRichTextMessage,
  vars: Record<string, ReactNode> | undefined,
  elements: Array<ReactElement<{ children?: ReactNode }>>,
) {
  if (!sourceStructure || !hasSameRichTextStructure(sourceStructure, translatedMessage.structure)) return undefined

  const renderNodes = (nodes: RichTextMessageNode[]): ReactNode[] | undefined => {
    const result: ReactNode[] = []

    for (const node of nodes) {
      if (node.type === "text") {
        result.push(node.value)
        continue
      }
      if (node.type === "variable") {
        result.push(vars && Object.hasOwn(vars, node.name) ? vars[node.name] : `{${node.name}}`)
        continue
      }

      const element = elements[node.index]
      if (!element) return undefined
      if (node.kind === "self-closing") {
        if (element.props.children !== undefined) return undefined
        result.push(cloneElement(element, { key: getRichTextElementKey(element, node.index) }))
        continue
      }
      if (typeof element.type === "string" && isVoidRichTextElement(element.type)) return undefined

      const translatedChildren = renderNodes(node.children)
      if (!translatedChildren) return undefined
      const normalizedChildren = Children.toArray(translatedChildren)
      result.push(
        cloneElement(
          element,
          { key: getRichTextElementKey(element, node.index) },
          ...(normalizedChildren.length > 0 ? normalizedChildren : [null]),
        ),
      )
    }

    return Children.toArray(result)
  }

  return renderNodes(translatedMessage.nodes)
}

function getRichTextElementKey(element: ReactElement, index: number) {
  return element.key === null ? `bt-${index}` : `bt-${index}:${element.key}`
}

function extractRuntimeElements(children: ReactNode) {
  const elements: Array<ReactElement<{ children?: ReactNode }>> = []

  const visit = (content: ReactNode): boolean => {
    let valid = true
    Children.forEach(content, (child) => {
      if (
        !valid ||
        child === null ||
        child === undefined ||
        typeof child === "boolean" ||
        typeof child === "string" ||
        typeof child === "number" ||
        (isValidElement<VarProps>(child) && isVarElement(child))
      ) {
        return
      }

      if (!isValidElement<{ children?: ReactNode }>(child)) {
        valid = false
        return
      }
      if (typeof child.type === "string" && !isSupportedRichTextElement(child.type)) {
        valid = false
        return
      }

      elements.push(child)
      if (child.props.children !== undefined) valid = visit(child.props.children)
    })
    return valid
  }

  return visit(children) ? elements : undefined
}

function extractRuntimeContent(children: ReactNode) {
  const parts: string[] = []
  const vars = Object.create(null) as Record<string, ReactNode>
  const elements: Array<ReactElement<{ children?: ReactNode }>> = []

  const visit = (content: ReactNode): boolean => {
    let valid = true
    Children.forEach(content, (child) => {
      if (!valid || child === null || child === undefined || typeof child === "boolean") return
      if (typeof child === "string" || typeof child === "number") {
        parts.push(String(child))
        return
      }

      if (isValidElement<VarProps>(child) && isVarElement(child)) {
        const entry = getRuntimeVarEntry(child.props)
        if (!entry) {
          valid = false
          return
        }
        parts.push(`{${entry.name}}`)
        vars[entry.name] = entry.value
        return
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        if (typeof child.type === "string" && !isSupportedRichTextElement(child.type)) {
          valid = false
          return
        }

        const index = elements.length
        elements.push(child)
        if (child.props.children === undefined) {
          parts.push(`<${index}/>`)
          return
        }

        parts.push(`<${index}>`)
        valid = visit(child.props.children)
        parts.push(`</${index}>`)
        return
      }

      valid = false
    })
    return valid
  }

  const valid = visit(children)
  if (!valid) return undefined

  return {
    elements,
    message: parts.join("").replace(/\s+/g, " ").trim(),
    vars: Object.keys(vars).length > 0 ? vars : undefined,
  }
}

function isVarElement(element: ReactElement<VarProps>) {
  return (
    element.type === Var ||
    (typeof element.type === "function" && (element.type as unknown as Record<symbol, unknown>)[VAR_MARKER] === true)
  )
}

function getRuntimeVarEntry(props: VarProps) {
  if (typeof props.name === "string" && Object.hasOwn(props, "value")) {
    return { name: props.name, value: props.value }
  }

  if (typeof props.name === "string" && Object.hasOwn(props, "children")) {
    return { name: props.name, value: props.children }
  }

  const entries = Object.entries(props).filter(([key]) => key !== "children")
  if (entries.length !== 1) return undefined

  const [name, value] = entries[0]!
  return { name, value }
}
