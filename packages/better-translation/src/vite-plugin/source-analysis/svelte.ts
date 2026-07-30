import { createRequire } from "node:module"

import type { ExtractedMessage } from "../../types.js"

import { getMessageId } from "../../message/id.js"
import { isSupportedRichTextElement, isVoidRichTextElement } from "../../message/rich-text.js"
import { analyzeFunctionMarker, type FunctionArgument, type FunctionProperty } from "./function-marker.js"
import {
  createSource,
  extractPlaceholdersFromMessage,
  formatPlaceholderValues,
  isValidPlaceholderName,
  recordPlaceholder,
  type SourceAnalysis,
  type SourceDiagnostic,
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
const RICH_SNIPPET_PREFIX = "__better_translation_"

/** Extracts messages from Svelte component markup and embedded expressions. */
export function analyzeSvelteSourceFile(code: string, filename: string, markers: SourceMarkers): SourceAnalysis {
  const messages: ExtractedMessage[] = []
  const edits: SourceEdit[] = []
  const diagnostics: SourceDiagnostic[] = []
  const authoredIdentifiers = new Set<string>()
  for (const match of code.matchAll(/[A-Za-z_$][\w$]*/g)) authoredIdentifiers.add(match[0])
  let ast: SvelteNode

  try {
    ast = loadSvelteCompiler().parse(code, { modern: true }) as unknown as SvelteNode
  } catch {
    return { parsed: false, messages, edits }
  }

  const callExpressions: SvelteCallExpression[] = []
  const components: SvelteNode[] = []
  walkSvelte(ast, (node) => {
    if (node.type === "CallExpression") callExpressions.push(node as SvelteCallExpression)
    if (node.type === "Component" && typeof node.name === "string" && markers.component.includes(node.name)) {
      components.push(node)
    }
  })

  // Call edits must exist before component analysis copies authored source into generated snippets and values.
  for (const node of callExpressions) {
    analyzeCallExpression(code, filename, markers, node, messages, edits, diagnostics)
  }
  const editPlan = createSvelteEditPlan(code, edits)
  for (const node of components) {
    analyzeTComponent(code, filename, markers, node, authoredIdentifiers, messages, edits, diagnostics, editPlan)
  }

  return {
    parsed: true,
    messages,
    edits: editPlan.getActiveEdits(edits),
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  }
}

function loadSvelteCompiler(): { parse: (code: string, options: { modern: true }) => unknown } {
  return require("svelte/compiler") as { parse: (code: string, options: { modern: true }) => unknown }
}

function createSvelteEditPlan(code: string, sourceEdits: readonly SourceEdit[]) {
  // Descending positions plus insertion order preserve the transform's same-position edit semantics.
  const indexedEdits = sourceEdits
    .map((edit, order) => ({ edit, order }))
    .sort((left, right) => right.edit.start - left.edit.start || left.order - right.order)
  const suppressedEdits = new Set<SourceEdit>()

  const forEachContainedEdit = (start: number, end: number, visit: (edit: SourceEdit) => void) => {
    let low = 0
    let high = indexedEdits.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (indexedEdits[middle]!.edit.start > end) low = middle + 1
      else high = middle
    }

    for (let index = low; index < indexedEdits.length; index++) {
      const edit = indexedEdits[index]!.edit
      if (edit.start < start) break
      if (edit.end <= end) visit(edit)
    }
  }

  return {
    getActiveEdits(edits: SourceEdit[]) {
      return suppressedEdits.size === 0 ? edits : edits.filter((edit) => !suppressedEdits.has(edit))
    },
    getEditedSourceSlice(start: number, end: number) {
      let source = code.slice(start, end)
      forEachContainedEdit(start, end, (edit) => {
        source = source.slice(0, edit.start - start) + edit.replacement + source.slice(edit.end - start)
      })
      return source
    },
    suppressContained(start: number, end: number) {
      forEachContainedEdit(start, end, (edit) => suppressedEdits.add(edit))
    },
  }
}

function analyzeCallExpression(
  code: string,
  filename: string,
  markers: SourceMarkers,
  node: SvelteCallExpression,
  messages: ExtractedMessage[],
  edits: SourceEdit[],
  diagnostics: SourceDiagnostic[],
) {
  if (node.callee?.type !== "Identifier") return
  if (typeof node.callee.name !== "string" || !markers.call.includes(node.callee.name)) return
  const messageArg = unwrapArgument(node.arguments?.[0])
  if (!isStringLiteral(messageArg)) return

  const args = node.arguments ?? []
  const result = analyzeFunctionMarker({
    marker: node.callee.name,
    message: messageArg.value,
    second: normalizeFunctionArgument(code, args[1]),
    third: normalizeFunctionArgument(code, args[2]),
  })

  if (result.kind === "skip") {
    const argument = args[result.diagnostic.argument]!
    diagnostics.push({
      code: result.diagnostic.code,
      start: argument.start!,
      end: argument.end!,
      message: result.diagnostic.message,
    })
    return
  }

  messages.push({
    id: result.id,
    defaultMessage: result.defaultMessage,
    meta: result.meta,
    placeholders: result.placeholders,
    source: createSource({
      filename,
      marker: node.callee.name,
      kind: "call",
    }),
  })

  if (result.edit) {
    const argument = args[result.edit.argument]!
    const editArgument = result.edit.kind === "replace" ? unwrapArgument(argument)! : argument
    edits.push({
      start: result.edit.kind === "replace" ? editArgument.start! : editArgument.end!,
      end: editArgument.end!,
      replacement: result.edit.replacement,
    })
  }
}

function analyzeTComponent(
  code: string,
  filename: string,
  markers: SourceMarkers,
  node: SvelteNode,
  authoredIdentifiers: ReadonlySet<string>,
  messages: ExtractedMessage[],
  edits: SourceEdit[],
  diagnostics: SourceDiagnostic[],
  editPlan: ReturnType<typeof createSvelteEditPlan>,
) {
  const idAttribute = getAttribute(node.attributes, "id")
  const explicitId = getStringAttribute(node.attributes, "id")
  if (idAttribute && explicitId === undefined) {
    diagnostics.push({
      code: "dynamic-lookup-id",
      start: idAttribute.start!,
      end: idAttribute.end!,
      message: `Translation marker <${node.name}> requires a static string id`,
    })
    return
  }

  const extraction =
    getGeneratedRichTextExtraction(node) ??
    extractSvelteChildren(code, node.fragment?.nodes ?? [], markers.component, authoredIdentifiers, editPlan)
  diagnostics.push(...extraction.diagnostics)
  if (!extraction.valid) {
    diagnostics.push({
      code: "non-static-message",
      start: node.start!,
      end: node.end!,
      message: `Translation marker <${node.name}> must contain static Message content`,
    })
    if (markers.logging) console.warn(`[better-translation] Non-static <${node.name}> in ${filename}, skipping`)
    return
  }

  const context = getStringAttribute(node.attributes, "context")
  const meta = context ? { context } : undefined
  const id = explicitId ?? getMessageId(extraction.message, meta)
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
      replacement: ` message={${JSON.stringify(extraction.message)}}`,
    })
  }

  if (!hasAttribute(node.attributes, "values") && extraction.values.length > 0 && insertAt !== undefined) {
    edits.push({
      start: insertAt,
      end: insertAt,
      replacement: ` values={{ ${formatPlaceholderValues(extraction.values)} }}`,
    })
  }

  if (extraction.snippetAliases.length > 0 && insertAt !== undefined) {
    edits.push({
      start: insertAt,
      end: insertAt,
      replacement: extraction.snippetAliases.join(""),
    })
  }

  if (extraction.snippets.length > 0 || extraction.values.length > 0) {
    const contentBounds = getSvelteElementContentBounds(code, node)
    if (contentBounds) {
      // Values move to generated props, so retaining their authored Var expressions would duplicate nested calls.
      editPlan.suppressContained(contentBounds.start, contentBounds.end)
      edits.push({
        start: contentBounds.start,
        end: contentBounds.end,
        replacement: extraction.snippets.length > 0 ? `\n  ${extraction.snippets.join("\n  ")}\n` : "",
      })
    }
  }
}

function extractSvelteChildren(
  code: string,
  children: SvelteNode[],
  componentMarkers: string[],
  authoredIdentifiers: ReadonlySet<string>,
  editPlan: ReturnType<typeof createSvelteEditPlan>,
) {
  const placeholders: string[] = []
  const values: Array<{ name: string; value: string }> = []
  const diagnostics: SourceDiagnostic[] = []
  const snippets: string[] = []
  const snippetAliases: string[] = []
  const generatedIdentifiers = new Set<string>()
  let nextRichTextElement = 0
  let nextCollisionSnippet = Number.MAX_SAFE_INTEGER

  const hasIdentifier = (name: string) => authoredIdentifiers.has(name) || generatedIdentifiers.has(name)
  const getSnippetName = (index: number) => {
    const preferredName = `${RICH_SNIPPET_PREFIX}${index}`
    if (!hasIdentifier(preferredName)) {
      generatedIdentifiers.add(preferredName)
      return preferredName
    }

    let name = `${RICH_SNIPPET_PREFIX}${nextCollisionSnippet--}`
    while (hasIdentifier(name)) name = `${RICH_SNIPPET_PREFIX}${nextCollisionSnippet--}`
    generatedIdentifiers.add(name)
    snippetAliases.push(` ${preferredName}={${name}}`)
    return name
  }

  const getSnippetParameter = (index: number) => {
    let name = `__better_translation_children_${index}`
    while (hasIdentifier(name)) name += "_"
    generatedIdentifiers.add(name)
    return name
  }

  const extractChildren = (nestedChildren: SvelteNode[]): string | undefined => {
    const parts: string[] = []

    for (const child of nestedChildren) {
      if (child.type === "Text") {
        parts.push(String(child.data ?? child.raw ?? ""))
        continue
      }

      if (child.type === "ExpressionTag") {
        const value = getStaticStringExpressionValue(child.expression)
        if (value === undefined) return undefined
        parts.push(value)
        continue
      }

      if (child.type === "Component" && child.name === "Var") {
        const entry = getVarEntry(child, editPlan)
        if (!entry) return undefined
        if (!isValidPlaceholderName(entry.name)) {
          diagnostics.push({
            code: "invalid-placeholder-name",
            start: child.start!,
            end: child.end!,
            message: `Var name ${JSON.stringify(entry.name)} must only contain letters, numbers, or underscores`,
          })
          return undefined
        }
        recordPlaceholder(placeholders, values, entry)
        parts.push(`{${entry.name}}`)
        continue
      }

      if (child.type === "Comment") continue

      const isComponent = child.type === "Component" && typeof child.name === "string"
      const isElement =
        child.type === "RegularElement" && typeof child.name === "string" && isSupportedRichTextElement(child.name)
      if (!isComponent && !isElement) return undefined
      if (isComponent && componentMarkers.includes(child.name!)) return undefined
      if (hasAttribute(child.attributes, "children")) return undefined

      const wrapper = getSvelteRichTextWrapper(code, child, editPlan)
      if (!wrapper) return undefined

      const index = nextRichTextElement++
      const snippetName = getSnippetName(index)
      const snippetParameter = getSnippetParameter(index)
      if (wrapper.selfClosing) {
        if ((child.fragment?.nodes ?? []).some((node) => node.type !== "Comment" && !isWhitespaceText(node))) {
          return undefined
        }
        snippets[index] = `{#snippet ${snippetName}(${snippetParameter})}${wrapper.source}{/snippet}`
        parts.push(`<${index}/>`)
        continue
      }

      const content = extractChildren(child.fragment?.nodes ?? [])
      if (content === undefined) return undefined
      snippets[index] =
        `{#snippet ${snippetName}(${snippetParameter})}` +
        `${wrapper.opening}{@render ${snippetParameter}()}${wrapper.closing}` +
        `{/snippet}`
      parts.push(`<${index}>${content}</${index}>`)
    }

    return parts.join("")
  }

  const extracted = extractChildren(children)
  if (extracted === undefined) {
    return { diagnostics, message: "", placeholders: [], snippetAliases: [], snippets: [], values: [], valid: false }
  }
  const message = extracted.replace(/\s+/g, " ").trim()
  return { diagnostics, message, placeholders, snippetAliases, snippets, values, valid: message.length > 0 }
}

function getGeneratedRichTextExtraction(node: SvelteNode) {
  const message = getStringAttribute(node.attributes, "message")
  if (message === undefined) return undefined

  const children = node.fragment?.nodes ?? []
  const snippets = children.filter((child) => child.type === "SnippetBlock")
  if (snippets.length === 0 && !hasAttribute(node.attributes, "values")) return undefined
  if (
    children.some(
      (child) =>
        child.type !== "Comment" &&
        !isWhitespaceText(child) &&
        (child.type !== "SnippetBlock" ||
          child.expression?.type !== "Identifier" ||
          typeof child.expression.name !== "string" ||
          !child.expression.name.startsWith(RICH_SNIPPET_PREFIX)),
    )
  ) {
    return undefined
  }

  return {
    diagnostics: [] as SourceDiagnostic[],
    message,
    placeholders: extractPlaceholdersFromMessage(message),
    snippetAliases: [] as string[],
    snippets: [] as string[],
    values: [] as Array<{ name: string; value: string }>,
    valid: message.length > 0,
  }
}

function getSvelteRichTextWrapper(code: string, node: SvelteNode, editPlan: ReturnType<typeof createSvelteEditPlan>) {
  if (node.start === undefined || node.end === undefined || typeof node.name !== "string") return undefined
  const openingEnd = getSvelteOpeningTagEnd(code, node)
  if (openingEnd === undefined) return undefined

  const opening = code.slice(node.start, openingEnd + 1)
  const selfClosing = /\/\s*>$/.test(opening) || (node.type === "RegularElement" && isVoidRichTextElement(node.name))
  if (selfClosing) {
    return {
      selfClosing: true as const,
      source: editPlan.getEditedSourceSlice(node.start, node.end),
    }
  }

  const closingStart = code.lastIndexOf(`</${node.name}`, node.end)
  if (closingStart <= openingEnd) return undefined
  return {
    closing: editPlan.getEditedSourceSlice(closingStart, node.end),
    opening: editPlan.getEditedSourceSlice(node.start, openingEnd + 1),
    selfClosing: false as const,
  }
}

function getSvelteElementContentBounds(code: string, node: SvelteNode) {
  if (node.end === undefined || typeof node.name !== "string") return undefined
  const openingEnd = getSvelteOpeningTagEnd(code, node)
  if (openingEnd === undefined) return undefined
  const closingStart = code.lastIndexOf(`</${node.name}`, node.end)
  if (closingStart <= openingEnd) return undefined
  return { end: closingStart, start: openingEnd + 1 }
}

function getSvelteOpeningTagEnd(code: string, node: SvelteNode) {
  if (node.start === undefined || typeof node.name !== "string") return undefined
  const lastAttributeEnd = node.attributes?.reduce(
    (end, attribute) => Math.max(end, attribute.end ?? end),
    node.start + node.name.length + 1,
  )
  const openingEnd = code.indexOf(">", lastAttributeEnd)
  return openingEnd < 0 || (node.end !== undefined && openingEnd >= node.end) ? undefined : openingEnd
}

function isWhitespaceText(node: SvelteNode) {
  return node.type === "Text" && String(node.data ?? node.raw ?? "").trim().length === 0
}

function getStaticStringExpressionValue(node?: SvelteNode) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  if (node?.type !== "TemplateLiteral" || !Array.isArray(node.expressions) || node.expressions.length > 0) return undefined
  if (!Array.isArray(node.quasis) || node.quasis.length !== 1) return undefined

  const value = (node.quasis[0] as SvelteNode | undefined)?.value
  if (typeof value !== "object" || value === null || !("cooked" in value)) return undefined
  return typeof value.cooked === "string" ? value.cooked : undefined
}

function getVarEntry(node: SvelteNode, editPlan: ReturnType<typeof createSvelteEditPlan>) {
  const explicitName = getStringAttribute(node.attributes, "name")
  const explicitValue = getExpressionAttributeSource(node.attributes, "value", editPlan)
  if (explicitName && explicitValue) return { name: explicitName, value: explicitValue }
  if (explicitName) return { name: explicitName, value: JSON.stringify(explicitName) }

  const shorthandAttribute = getSingleExpressionAttribute(node.attributes)
  if (!shorthandAttribute) return undefined
  return {
    name: shorthandAttribute.name,
    value: editPlan.getEditedSourceSlice(shorthandAttribute.expression.start!, shorthandAttribute.expression.end!),
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
  const attribute = getAttribute(attributes, name)
  if (!attribute) return undefined
  if (typeof attribute.value === "string") return attribute.value

  const value = Array.isArray(attribute.value) ? attribute.value[0] : attribute.value
  if (!value || value === true) return undefined
  if (value?.type === "Text") return String(value.data ?? value.raw ?? "")
  if (value.type === "ExpressionTag" && isStringLiteral(value.expression)) return value.expression.value
}

function getAttribute(attributes: SvelteNode[] | undefined, name: string) {
  return attributes?.find((entry) => entry.type === "Attribute" && entry.name === name) as SvelteAttribute | undefined
}

function getExpressionAttributeSource(
  attributes: SvelteNode[] | undefined,
  name: string,
  editPlan: ReturnType<typeof createSvelteEditPlan>,
) {
  const attribute = attributes?.find((entry) => entry.type === "Attribute" && entry.name === name) as SvelteAttribute | undefined
  const value = attribute?.value
  if (!isExpressionAttributeValue(value)) return undefined
  return editPlan.getEditedSourceSlice(value.expression.start!, value.expression.end!)
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

function normalizeFunctionArgument(code: string, node?: SvelteNode): FunctionArgument | undefined {
  const argument = unwrapArgument(node)
  if (!argument) return undefined
  if (isStringLiteral(argument)) {
    return {
      kind: "string",
      value: argument.value,
      source: code.slice(argument.start, argument.end),
    }
  }
  if (argument.type !== "ObjectExpression") return { kind: "opaque" }

  return {
    kind: "object",
    source: code.slice(argument.start, argument.end),
    properties: ((argument.properties as SvelteNode[] | undefined) ?? []).map(normalizeFunctionProperty),
  }
}

function normalizeFunctionProperty(property: SvelteNode): FunctionProperty {
  if ((property.type !== "ObjectProperty" && property.type !== "Property") || property.computed === true || !property.value) {
    return { kind: "opaque" }
  }

  const key = getPropertyKey(property)
  if (key === undefined) return { kind: "opaque" }

  const value = unwrapArgument(property.value as SvelteNode)
  return {
    kind: "property",
    key,
    value: value && isStringLiteral(value) ? { kind: "string", value: value.value } : { kind: "dynamic" },
  }
}

function unwrapArgument(node?: SvelteNode) {
  let argument = node
  while (
    argument?.expression &&
    (argument.type === "ChainExpression" ||
      argument.type === "ParenthesizedExpression" ||
      argument.type === "TSAsExpression" ||
      argument.type === "TSInstantiationExpression" ||
      argument.type === "TSNonNullExpression" ||
      argument.type === "TSSatisfiesExpression" ||
      argument.type === "TSTypeAssertion")
  ) {
    argument = argument.expression
  }
  return argument
}

function getPropertyKey(property: SvelteNode) {
  const key = property.key as SvelteNode | undefined
  if (key?.type === "Identifier" && typeof key.name === "string") return key.name
  if (key?.type === "Literal" && typeof key.value === "string") return key.value
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
