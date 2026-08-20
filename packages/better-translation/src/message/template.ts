import { getOwnValue } from "./value-record.js"

const PLACEHOLDER_PATTERN_SOURCE = String.raw`\{(\w+)\}`
const RICH_TEXT_PATTERN_SOURCE = String.raw`<(\/?)(\d+)(\/?)>`

export type RichTextElement = {
  kind: "paired" | "self-closing"
  parent?: number
}

export type RichTextMessageNode =
  | {
      key: string
      type: "text"
      value: string
    }
  | {
      key: string
      name: string
      type: "variable"
    }
  | {
      children: RichTextMessageNode[]
      index: number
      key: string
      kind: "paired" | "self-closing"
      type: "element"
    }

export type MessageStructure = {
  elements: Map<number, RichTextElement>
  variables: Map<string, number>
}

export type ParsedRichTextMessage = {
  nodes: RichTextMessageNode[]
  structure: MessageStructure
}

export function isValidPlaceholderName(name: string) {
  return /^\w+$/.test(name)
}

export function getMessagePlaceholderNames(message: string) {
  const names = new Set<string>()
  for (const match of message.matchAll(new RegExp(PLACEHOLDER_PATTERN_SOURCE, "g"))) {
    if (match[1]) names.add(match[1])
  }
  return [...names]
}

export function hasMessagePlaceholder(message: string, name: string) {
  for (const match of message.matchAll(new RegExp(PLACEHOLDER_PATTERN_SOURCE, "g"))) {
    if (match[1] === name) return true
  }
  return false
}

export function interpolateMessageTemplate(template: string, values: Record<string, string>) {
  return template.replace(
    new RegExp(PLACEHOLDER_PATTERN_SOURCE, "g"),
    (_, name: string) => getOwnValue(values, name) ?? `{${name}}`,
  )
}

/**
 * Verifies that a Locale value preserves placeholder multiplicity and every
 * Rich-text slot's paired/self-closing kind and authored parent topology.
 */
export function hasSameMessageStructure(sourceMessage: string, translatedMessage: string) {
  const source = getMessageStructure(sourceMessage)
  const translated = getMessageStructure(translatedMessage)
  if (!source || !translated) return false
  return hasSameRichTextStructure(source, translated)
}

export function hasSameRichTextStructure(source: MessageStructure, translated: MessageStructure) {
  if (source.variables.size !== translated.variables.size) return false
  for (const [variable, count] of source.variables) {
    if (translated.variables.get(variable) !== count) return false
  }

  if (source.elements.size !== translated.elements.size) return false
  for (const [index, element] of source.elements) {
    const translatedElement = translated.elements.get(index)
    if (translatedElement?.kind !== element.kind || translatedElement.parent !== element.parent) return false
  }
  return true
}

export function getMessageStructure(message: string): MessageStructure | undefined {
  return scanMessageTemplate(message, false)?.structure
}

export function parseRichTextMessage(message: string): ParsedRichTextMessage | undefined {
  const parsed = scanMessageTemplate(message, true)
  if (!parsed?.nodes) return undefined
  return {
    nodes: parsed.nodes,
    structure: parsed.structure,
  }
}

function scanMessageTemplate(message: string, collectNodes: boolean) {
  const elements = new Map<number, RichTextElement>()
  const variables = new Map<string, number>()
  const nodes: RichTextMessageNode[] | undefined = collectNodes ? [] : undefined
  const stack: Array<{ children?: RichTextMessageNode[]; index: number }> = []
  const matcher = new RegExp(`${RICH_TEXT_PATTERN_SOURCE}|${PLACEHOLDER_PATTERN_SOURCE}`, "g")
  let lastIndex = 0
  let nextText = 0
  let match: RegExpExecArray | null

  const getChildren = () => stack.at(-1)?.children ?? nodes
  const addText = (value: string) => {
    const children = getChildren()
    if (!children || value.length === 0) return
    children.push({
      key: `text:${nextText++}`,
      type: "text",
      value,
    })
  }

  while ((match = matcher.exec(message)) !== null) {
    if (match.index > lastIndex) addText(message.slice(lastIndex, match.index))
    const variable = match[4]
    if (variable) {
      const count = (variables.get(variable) ?? 0) + 1
      variables.set(variable, count)
      getChildren()?.push({
        key: `variable:${variable}:${count}`,
        name: variable,
        type: "variable",
      })
      lastIndex = matcher.lastIndex
      continue
    }

    const indexText = match[2]
    if (!indexText) return undefined

    const index = Number(indexText)
    if (!Number.isSafeInteger(index) || String(index) !== indexText) return undefined

    const closing = match[1] === "/"
    const selfClosing = match[3] === "/"
    if (closing) {
      if (selfClosing || stack.pop()?.index !== index) return undefined
      lastIndex = matcher.lastIndex
      continue
    }

    if (elements.has(index)) return undefined
    elements.set(index, {
      kind: selfClosing ? "self-closing" : "paired",
      ...(stack.at(-1) === undefined ? {} : { parent: stack.at(-1)?.index }),
    })
    const node: RichTextMessageNode | undefined = collectNodes
      ? {
          children: [],
          index,
          key: `element:${index}`,
          kind: selfClosing ? "self-closing" : "paired",
          type: "element",
        }
      : undefined
    if (node) getChildren()?.push(node)
    if (!selfClosing) stack.push({ ...(node ? { children: node.children } : {}), index })
    lastIndex = matcher.lastIndex
  }

  if (stack.length > 0) return undefined
  if (lastIndex < message.length) addText(message.slice(lastIndex))
  return {
    nodes,
    structure: { elements, variables },
  }
}
