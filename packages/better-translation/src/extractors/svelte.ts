import { createRequire } from "node:module"

import type { ExtractedMessage, TranslateOptions } from "../types.js"

import { getCallMessageId, getMessageId } from "../message-id.js"
import {
  createSource,
  extractPlaceholdersFromMessage,
  type SourceAnalysis,
  type SourceEdit,
  type SourceMarkers,
} from "./types.js"

type SvelteNode = {
  type?: string
  start?: number
  end?: number
  name?: string
  attributes?: SvelteNode[]
  fragment?: {
    nodes?: SvelteNode[]
  }
  value?: unknown
  raw?: string
  data?: string
  expression?: SvelteNode
  [key: string]: unknown
}

type SvelteAttribute = SvelteNode & {
  name?: string
  value?: SvelteNode | SvelteNode[] | true
}

type SvelteCallExpression = SvelteNode & {
  callee?: SvelteNode
  arguments?: SvelteNode[]
}

const require = createRequire(import.meta.url)

/** Extracts messages from Svelte component markup and embedded expressions. */
export function analyzeSvelteSourceFile(code: string, filename: string, markers: SourceMarkers): SourceAnalysis {
  const messages: ExtractedMessage[] = []
  const edits: SourceEdit[] = []
  let ast: SvelteNode

  try {
    ast = loadSvelteCompiler().parse(code, { modern: true }) as unknown as SvelteNode
  } catch {
    return { parsed: false, messages, edits }
  }

  walkSvelte(ast, (node) => {
    if (node.type === "Component" && typeof node.name === "string" && markers.component.includes(node.name)) {
      analyzeTComponent(code, filename, markers, node, messages, edits)
      return
    }

    if (node.type === "CallExpression") {
      analyzeCallExpression(code, filename, markers, node as SvelteCallExpression, messages, edits)
    }
  })

  return { parsed: true, messages, edits }
}

function loadSvelteCompiler(): { parse: (code: string, options: { modern: true }) => unknown } {
  return require("svelte/compiler") as { parse: (code: string, options: { modern: true }) => unknown }
}

function analyzeCallExpression(
  code: string,
  filename: string,
  markers: SourceMarkers,
  node: SvelteCallExpression,
  messages: ExtractedMessage[],
  edits: SourceEdit[],
) {
  if (node.callee?.type !== "Identifier") return
  if (typeof node.callee.name !== "string" || !markers.call.includes(node.callee.name)) return
  const [messageArg] = node.arguments ?? []
  if (!isStringLiteral(messageArg)) return

  const value = String(messageArg.value)
  const meta = getCallMetaArgument(node.arguments ?? [])
  const id = getCallMessageId(value, meta)
  messages.push({
    id,
    defaultMessage: value,
    meta: meta ?? {},
    placeholders: extractPlaceholdersFromMessage(value),
    source: createSource({
      filename,
      marker: node.callee.name,
      kind: "call",
    }),
  })

  const edit = createCallOptionsEdit(code, node.arguments ?? [], id)
  if (edit) edits.push(edit)
}

function analyzeTComponent(
  code: string,
  filename: string,
  markers: SourceMarkers,
  node: SvelteNode,
  messages: ExtractedMessage[],
  edits: SourceEdit[],
) {
  const extraction = extractSvelteChildren(code, node.fragment?.nodes ?? [])
  if (!extraction.valid) {
    if (markers.logging) console.warn(`[better-translation] Non-static <${node.name}> in ${filename}, skipping`)
    return
  }

  const context = getStringAttribute(node.attributes, "context")
  const meta = context ? { context } : undefined
  const id = getStringAttribute(node.attributes, "id") ?? getMessageId(extraction.message, meta)
  messages.push({
    id,
    defaultMessage: extraction.message,
    meta: meta ?? {},
    placeholders: extraction.placeholders,
    source: createSource({
      filename,
      marker: String(node.name),
      kind: "component",
    }),
  })

  const insertAt = getSvelteOpeningTagNameEnd(code, node)
  if (!hasAttribute(node.attributes, "id") && insertAt !== undefined) {
    edits.push({
      start: insertAt,
      end: insertAt,
      replacement: ` id=${JSON.stringify(id)}`,
    })
  }

  if (!hasAttribute(node.attributes, "message") && insertAt !== undefined) {
    edits.push({
      start: insertAt,
      end: insertAt,
      replacement: ` message=${JSON.stringify(extraction.message)}`,
    })
  }

  if (!hasAttribute(node.attributes, "values") && extraction.values.length > 0 && insertAt !== undefined) {
    edits.push({
      start: insertAt,
      end: insertAt,
      replacement: ` values={{ ${extraction.values.map((entry) => `${entry.name}: ${entry.value}`).join(", ")} }}`,
    })
  }
}

function extractSvelteChildren(code: string, children: SvelteNode[]) {
  const parts: string[] = []
  const placeholders: string[] = []
  const values: Array<{ name: string; value: string }> = []

  for (const child of children) {
    if (child.type === "Text") {
      parts.push(String(child.data ?? child.raw ?? ""))
      continue
    }

    if (child.type === "Component" && child.name === "Var") {
      const entry = getVarEntry(code, child)
      if (!entry) return { message: "", placeholders: [], values: [], valid: false }
      placeholders.push(entry.name)
      values.push(entry)
      parts.push(`{${entry.name}}`)
      continue
    }

    if (child.type === "Comment") continue
    return { message: "", placeholders: [], values: [], valid: false }
  }

  const message = parts.join("").replace(/\s+/g, " ").trim()
  return { message, placeholders, values, valid: message.length > 0 }
}

function getVarEntry(code: string, node: SvelteNode) {
  const explicitName = getStringAttribute(node.attributes, "name")
  const explicitValue = getExpressionAttributeSource(code, node.attributes, "value")
  if (explicitName && explicitValue) return { name: explicitName, value: explicitValue }
  if (explicitName) return { name: explicitName, value: JSON.stringify(explicitName) }

  const shorthandAttribute = getSingleExpressionAttribute(node.attributes)
  if (!shorthandAttribute) return undefined
  return {
    name: shorthandAttribute.name,
    value: code.slice(shorthandAttribute.expression.start!, shorthandAttribute.expression.end!),
  }
}

function getSingleExpressionAttribute(attributes?: SvelteNode[]) {
  const expressionAttributes = (attributes ?? []).flatMap((attribute) => {
    if (attribute.type !== "Attribute" || typeof attribute.name !== "string") return []
    const value = (attribute as SvelteAttribute).value
    return isExpressionAttributeValue(value) ? [{ name: attribute.name, expression: value.expression }] : []
  })

  return expressionAttributes.length === 1 ? expressionAttributes[0] : undefined
}

function getStringAttribute(attributes: SvelteNode[] | undefined, name: string) {
  const attribute = attributes?.find((entry) => entry.type === "Attribute" && entry.name === name) as SvelteAttribute | undefined
  if (!attribute) return undefined
  if (typeof attribute.value === "string") return attribute.value

  const value = Array.isArray(attribute.value) ? attribute.value[0] : attribute.value
  if (!value || value === true) return undefined
  if (value?.type === "Text") return String(value.data ?? value.raw ?? "")
}

function getExpressionAttributeSource(code: string, attributes: SvelteNode[] | undefined, name: string) {
  const attribute = attributes?.find((entry) => entry.type === "Attribute" && entry.name === name) as SvelteAttribute | undefined
  const value = attribute?.value
  if (!isExpressionAttributeValue(value)) return undefined
  return code.slice(value.expression.start!, value.expression.end!)
}

function hasAttribute(attributes: SvelteNode[] | undefined, name: string) {
  return attributes?.some((entry) => entry.type === "Attribute" && entry.name === name) ?? false
}

function getSvelteOpeningTagNameEnd(code: string, node: SvelteNode) {
  if (node.start === undefined || typeof node.name !== "string") return undefined
  const tagStart = code.indexOf(`<${node.name}`, node.start)
  if (tagStart < 0) return undefined
  return tagStart + node.name.length + 1
}

function isExpressionAttributeValue(value: SvelteAttribute["value"]): value is SvelteNode & { expression: SvelteNode } {
  if (Array.isArray(value) || value === true || !value) return false
  return value.type === "ExpressionTag" && value.expression !== undefined
}

function isStringLiteral(node?: SvelteNode): node is SvelteNode & { value: string } {
  return node?.type === "Literal" && typeof node.value === "string"
}

function getCallMetaArgument(args: SvelteNode[]) {
  return getMetaArgument(isTranslateOptionsArgument(args[1]) ? args[1] : args[2])
}

function getMetaArgument(node?: SvelteNode) {
  if (!node) return undefined
  if (isStringLiteral(node)) return { context: node.value }
  if (node.type !== "ObjectExpression") return undefined

  const meta: TranslateOptions = {}
  for (const property of (node.properties as SvelteNode[] | undefined) ?? []) {
    const key = getPropertyKey(property)
    const value = property.value as SvelteNode | undefined
    if ((key === "context" || key === "id") && isStringLiteral(value)) meta[key] = value.value
  }

  return Object.keys(meta).length > 0 ? meta : undefined
}

function createCallOptionsEdit(code: string, args: SvelteNode[], id: string): SourceEdit | undefined {
  const valuesArg = args[1]
  const optionsArg = isTranslateOptionsArgument(valuesArg) ? valuesArg : args[2]

  if (!optionsArg) {
    return {
      start: (valuesArg ?? args[0])!.end!,
      end: (valuesArg ?? args[0])!.end!,
      replacement: `, { id: ${JSON.stringify(id)} }`,
    }
  }

  if (isStringLiteral(optionsArg)) {
    const contextValue = code.slice(optionsArg.start, optionsArg.end)
    return {
      start: optionsArg.start!,
      end: optionsArg.end!,
      replacement: `{ id: ${JSON.stringify(id)}, context: ${contextValue} }`,
    }
  }

  if (optionsArg.type !== "ObjectExpression") return undefined
  if (hasObjectProperty(optionsArg, "id")) return undefined

  const objectSource = code.slice(optionsArg.start, optionsArg.end)
  const innerSource = objectSource.slice(1, -1)
  const replacement =
    innerSource.trim().length > 0 ? `{ id: ${JSON.stringify(id)},${innerSource} }` : `{ id: ${JSON.stringify(id)} }`

  return {
    start: optionsArg.start!,
    end: optionsArg.end!,
    replacement,
  }
}

function isTranslateOptionsArgument(node?: SvelteNode) {
  if (!node) return false
  if (isStringLiteral(node)) return true
  if (node.type !== "ObjectExpression") return false

  return ((node.properties as SvelteNode[] | undefined) ?? []).every((property) => {
    const key = getPropertyKey(property)
    return key === "context" || key === "id"
  })
}

function getPropertyKey(property: SvelteNode) {
  const key = property.key as SvelteNode | undefined
  if (key?.type === "Identifier" && typeof key.name === "string") return key.name
  if (key?.type === "Literal" && typeof key.value === "string") return key.value
}

function hasObjectProperty(node: SvelteNode, name: string) {
  return ((node.properties as SvelteNode[] | undefined) ?? []).some((property) => getPropertyKey(property) === name)
}

function walkSvelte(node: unknown, visit: (node: SvelteNode) => void, seen = new Set<unknown>()) {
  if (!node || typeof node !== "object" || seen.has(node)) return
  seen.add(node)

  const current = node as SvelteNode
  visit(current)

  for (const value of Object.values(current)) {
    if (!value || typeof value !== "object") continue
    if (Array.isArray(value)) {
      for (const item of value) walkSvelte(item, visit, seen)
      continue
    }
    walkSvelte(value, visit, seen)
  }
}
