import { Children, createContext, isValidElement, useContext, useMemo, type ReactNode } from "react"

import { getMessageId } from "./message-id.js"

interface I18nContextValue {
  messages: Record<string, string>
}

const I18nContext = createContext<I18nContextValue>({ messages: {} })

export function I18nProvider({ messages, children }: { messages: Record<string, string>; children: ReactNode }) {
  return <I18nContext.Provider value={{ messages }}>{children}</I18nContext.Provider>
}

export function useMessages() {
  return useContext(I18nContext).messages
}

export function useT() {
  const { messages } = useContext(I18nContext)
  return (id: string) => messages[id] ?? id
}

export function Var({ children }: { name: string; children: ReactNode }) {
  return <>{children}</>
}

export function T({ id, children }: { id?: string; children?: ReactNode }) {
  const { messages } = useContext(I18nContext)
  const extraction = useMemo(() => extractRuntimeMessage(children), [children])
  const template = messages[id ?? (extraction.message ? getMessageId(extraction.message) : "")]

  const interpolated = useMemo(() => interpolate(template, extraction.vars), [template, extraction.vars])
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
  const vars: Record<string, ReactNode> = {}

  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      parts.push(String(child))
      return
    }

    if (isValidElement<{ name: string; children: ReactNode }>(child) && child.type === Var) {
      vars[child.props.name] = child.props.children
      parts.push(`{${child.props.name}}`)
    }
  })

  return { message: parts.join("").replace(/\s+/g, " ").trim(), vars }
}
