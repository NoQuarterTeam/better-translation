import type { Argument, CallExpression, JSXChild, StringLiteral, TemplateLiteral } from "oxc-parser"
import { parseSync, Visitor } from "oxc-parser"

import type { ExtractedMessage, MessageSource, TranslateOptions } from "./types.js"

import { getCallMessageId, getMessageId } from "./message-id.js"

interface Markers {
  call: string[]
  component: string[]
  taggedTemplate: string[]
  logging: boolean
}

export interface SourceEdit {
  start: number
  end: number
  replacement: string
}

export interface SourceAnalysis {
  parsed: boolean
  messages: ExtractedMessage[]
  edits: SourceEdit[]
}

/** Extracts messages and source edits from a file in one coordinated parse pass. */
export function analyzeSourceFile(code: string, filename: string, markers: Markers): SourceAnalysis {
  const messages: ExtractedMessage[] = []
  const edits: SourceEdit[] = []
  const result = parseSync(filename, code)
  if (result.errors.length > 0) return { parsed: false, messages, edits }
  const lineStarts = getLineStarts(code)

  const visitor = new Visitor({
    CallExpression(node) {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "msg" &&
        node.arguments.length >= 1 &&
        isStringLiteral(node.arguments[0]!)
      ) {
        const value = (node.arguments[0] as StringLiteral).value
        const meta = getMsgMetaArgument(node.arguments)
        const id = getCallMessageId(value, meta)
        messages.push({
          id,
          defaultMessage: value,
          meta: meta ?? {},
          placeholders: extractPlaceholdersFromMessage(value),
          source: createSource({
            filename,
            lineStarts,
            marker: node.callee.name,
            kind: "call",
            start: node.start,
            end: node.end,
          }),
        })
        return
      }

      if (
        node.callee.type === "Identifier" &&
        markers.call.includes(node.callee.name) &&
        node.arguments.length >= 1 &&
        isStringLiteral(node.arguments[0]!)
      ) {
        const value = (node.arguments[0] as StringLiteral).value
        const meta = getCallMetaArgument(node.arguments)
        const id = getCallMessageId(value, meta)
        messages.push({
          id,
          defaultMessage: value,
          meta: meta ?? {},
          placeholders: [],
          source: createSource({
            filename,
            lineStarts,
            marker: node.callee.name,
            kind: "call",
            start: node.start,
            end: node.end,
          }),
        })

        const callOptionsEdit = createCallOptionsEdit(code, node.arguments, id)
        if (callOptionsEdit) edits.push(callOptionsEdit)
      }
    },

    JSXElement(node) {
      const opening = node.openingElement
      if (
        opening.name.type === "JSXIdentifier" &&
        opening.name.name === "Var" &&
        (opening.attributes as Array<unknown>).length === 0
      ) {
        const identifier = getVarChildIdentifier(node.children)
        if (identifier) {
          edits.push({
            start: node.start,
            end: node.end,
            replacement: `<Var ${identifier}={${identifier}} />`,
          })
        }
      }

      if (opening.name.type !== "JSXIdentifier") return
      if (!markers.component.includes(opening.name.name)) return

      const extraction = extractJSXChildren(node.children)
      if (!extraction.valid) {
        if (markers.logging) {
          console.warn(`[better-translation] Non-static <${opening.name.name}> in ${filename}, skipping`)
        }
        return
      }

      const context = getJSXStringAttribute(opening.attributes, "context")
      const meta = context ? { context } : undefined
      const id = getJSXStringAttribute(opening.attributes, "id") ?? getMessageId(extraction.message, meta)
      messages.push({
        id,
        defaultMessage: extraction.message,
        meta: meta ?? {},
        placeholders: extraction.placeholders,
        source: createSource({
          filename,
          lineStarts,
          marker: opening.name.name,
          kind: "component",
          start: node.start,
          end: node.end,
        }),
      })

      if (!hasJSXAttribute(opening.attributes as Array<unknown>, "id")) {
        edits.push({
          start: opening.name.end,
          end: opening.name.end,
          replacement: ` id="${id}"`,
        })
      }
    },

    TaggedTemplateExpression(node) {
      const tag = node.tag
      if (
        tag.type !== "CallExpression" ||
        tag.callee.type !== "Identifier" ||
        !markers.taggedTemplate.includes(tag.callee.name) ||
        tag.arguments.length < 1 ||
        !isStringLiteral(tag.arguments[0]!)
      ) {
        return
      }

      const id = (tag.arguments[0] as StringLiteral).value
      const extraction = extractTaggedTemplate(node.quasi)
      if (!extraction.valid) {
        if (markers.logging) {
          console.warn(`[better-translation] Non-static tagged template in ${filename}, skipping`)
        }
        return
      }

      messages.push({
        id,
        defaultMessage: extraction.message,
        meta: {},
        placeholders: extraction.placeholders,
        source: createSource({
          filename,
          lineStarts,
          marker: tag.callee.name,
          kind: "tagged-template",
          start: node.start,
          end: node.end,
        }),
      })
    },
  })

  visitor.visit(result.program)
  return { parsed: true, messages, edits }
}

function isStringLiteral(node: Argument): node is StringLiteral {
  return node.type === "Literal" && typeof (node as StringLiteral).value === "string"
}

function getMetaArgument(node?: Argument) {
  if (!node) return undefined
  if (isStringLiteral(node)) return { context: node.value }

  if (node.type !== "ObjectExpression") return undefined

  const meta: TranslateOptions = {}

  for (const property of node.properties as Array<{
    type: string
    key?: { type: string; name?: string; value?: unknown }
    value?: Argument
  }>) {
    if (
      property.type === "ObjectProperty" &&
      ((property.key?.type === "Identifier" && (property.key.name === "context" || property.key.name === "id")) ||
        (property.key?.type === "Literal" && (property.key.value === "context" || property.key.value === "id"))) &&
      property.value &&
      isStringLiteral(property.value)
    ) {
      const key = property.key?.type === "Identifier" ? property.key.name : property.key?.value
      if (key === "context" || key === "id") meta[key] = property.value.value
    }
  }

  return Object.keys(meta).length > 0 ? meta : undefined
}

function getMsgMetaArgument(args: Argument[]) {
  return getMetaArgument(args[2] ?? args[1])
}

function getCallMetaArgument(args: Argument[]) {
  return getMetaArgument(isTranslateOptionsArgument(args[1]) ? args[1] : args[2])
}

function createCallOptionsEdit(code: string, args: Argument[], id: string) {
  const valuesArg = args[1]
  const optionsArg = isTranslateOptionsArgument(valuesArg) ? valuesArg : args[2]

  if (!optionsArg) {
    return {
      start: (valuesArg ?? args[0]!).end,
      end: (valuesArg ?? args[0]!).end,
      replacement: `, { id: ${JSON.stringify(id)} }`,
    }
  }

  if (isStringLiteral(optionsArg)) {
    const contextValue = code.slice(optionsArg.start, optionsArg.end)
    return {
      start: optionsArg.start,
      end: optionsArg.end,
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
    start: optionsArg.start,
    end: optionsArg.end,
    replacement,
  }
}

function isTranslateOptionsArgument(node?: Argument) {
  if (!node) return false
  if (isStringLiteral(node)) return true
  if (node.type !== "ObjectExpression") return false

  return (node.properties as Array<unknown>).every((entry) => {
    const property = entry as
      | {
          type?: string
          key?: { type?: string; name?: string; value?: unknown }
        }
      | undefined

    if (property?.type !== "ObjectProperty") return false

    return (
      (property.key?.type === "Identifier" && (property.key.name === "context" || property.key.name === "id")) ||
      (property.key?.type === "Literal" && (property.key.value === "context" || property.key.value === "id"))
    )
  })
}

function getJSXStringAttribute(attributes: Array<unknown>, name: string) {
  for (const attr of attributes as Array<{
    type: string
    name?: { type: string; name?: string }
    value?: { type: string; value?: unknown } | null
  }>) {
    if (
      attr.type === "JSXAttribute" &&
      attr.name?.type === "JSXIdentifier" &&
      attr.name.name === name &&
      attr.value?.type === "Literal" &&
      typeof attr.value.value === "string"
    ) {
      return attr.value.value as string
    }
  }
}

function hasJSXAttribute(attributes: Array<unknown>, name: string) {
  return attributes.some((attr) => {
    const attribute = attr as
      | {
          type?: string
          name?: { type?: string; name?: string }
        }
      | undefined

    return attribute?.type === "JSXAttribute" && attribute.name?.type === "JSXIdentifier" && attribute.name.name === name
  })
}

function hasObjectProperty(node: { properties: Array<unknown> }, name: string) {
  return node.properties.some((entry) => {
    const property = entry as
      | {
          type?: string
          key?: { type?: string; name?: string; value?: unknown }
        }
      | undefined

    if (property?.type !== "ObjectProperty") return false
    return (
      (property.key?.type === "Identifier" && property.key.name === name) ||
      (property.key?.type === "Literal" && property.key.value === name)
    )
  })
}

function extractPlaceholdersFromMessage(message: string) {
  const names = new Set<string>()
  for (const match of message.matchAll(/\{(\w+)\}/g)) {
    if (match[1]) names.add(match[1])
  }
  return [...names]
}

function createSource({
  filename,
  lineStarts,
  marker,
  kind,
  start,
  end,
}: {
  filename: string
  lineStarts: number[]
  marker: string
  kind: MessageSource["kind"]
  start: number
  end: number
}): MessageSource {
  const startPosition = getPosition(start, lineStarts)
  const endPosition = getPosition(end, lineStarts)

  return {
    file: filename,
    kind,
    marker,
    line: startPosition.line,
    column: startPosition.column,
    endLine: endPosition.line,
    endColumn: endPosition.column,
    start,
    end,
  }
}

function getLineStarts(code: string) {
  const starts = [0]
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "\n") starts.push(i + 1)
  }
  return starts
}

function getPosition(offset: number, lineStarts: number[]) {
  let low = 0
  let high = lineStarts.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const lineStart = lineStarts[mid]!
    const nextLineStart = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY

    if (offset < lineStart) {
      high = mid - 1
      continue
    }

    if (offset >= nextLineStart) {
      low = mid + 1
      continue
    }

    return { line: mid + 1, column: offset - lineStart + 1 }
  }

  const lastLine = lineStarts.length - 1
  const lastStart = lineStarts[lastLine] ?? 0
  return { line: lastLine + 1, column: offset - lastStart + 1 }
}

interface ExtractionResult {
  message: string
  placeholders: string[]
  valid: boolean
}

function extractJSXChildren(children: Array<JSXChild>): ExtractionResult {
  const parts: string[] = []
  const placeholders: string[] = []

  for (const child of children) {
    switch (child.type) {
      case "JSXText":
        parts.push(child.value)
        break

      case "JSXElement": {
        const name = child.openingElement.name
        if (name.type !== "JSXIdentifier" || name.name !== "Var") {
          return { message: "", placeholders: [], valid: false }
        }

        const varName = getVarPlaceholderName(child)
        if (!varName) return { message: "", placeholders: [], valid: false }

        placeholders.push(varName)
        parts.push(`{${varName}}`)
        break
      }

      case "JSXExpressionContainer":
        if (child.expression.type !== "JSXEmptyExpression") {
          return { message: "", placeholders: [], valid: false }
        }
        break

      default:
        break
    }
  }

  const message = parts.join("").replace(/\s+/g, " ").trim()
  return { message, placeholders, valid: message.length > 0 }
}

function getVarPlaceholderName(node: { openingElement: { attributes: Array<unknown> }; children: Array<JSXChild> }) {
  const explicitName = getJSXStringAttribute(node.openingElement.attributes as Array<unknown>, "name")
  if (explicitName) return explicitName

  const customPropName = getSingleJSXAttributeName(node.openingElement.attributes as Array<unknown>)
  if (customPropName) return customPropName

  return getVarChildIdentifier(node.children)
}

function getSingleJSXAttributeName(attributes: Array<unknown>) {
  const keys = attributes.flatMap((attr) => {
    const attribute = attr as
      | {
          type?: string
          name?: { type?: string; name?: string }
        }
      | undefined

    if (attribute?.type !== "JSXAttribute" || attribute.name?.type !== "JSXIdentifier") return []
    return [attribute.name.name]
  })

  return keys.length === 1 ? keys[0] : undefined
}

function getVarChildIdentifier(children: Array<JSXChild>) {
  const meaningfulChildren = children.filter((child) => !(child.type === "JSXText" && child.value.trim().length === 0))
  if (meaningfulChildren.length !== 1) return undefined

  const [child] = meaningfulChildren
  if (!child || child.type !== "JSXExpressionContainer" || child.expression.type !== "Identifier") return undefined
  return child.expression.name
}

function extractTaggedTemplate(quasi: TemplateLiteral): ExtractionResult {
  const parts: string[] = []
  const placeholders: string[] = []

  for (let i = 0; i < quasi.quasis.length; i++) {
    const element = quasi.quasis[i]!
    parts.push(element.value.cooked ?? element.value.raw)

    if (i < quasi.expressions.length) {
      const expr = quasi.expressions[i]!
      if (expr.type !== "CallExpression") return { message: "", placeholders: [], valid: false }

      const call = expr as CallExpression
      if (
        call.callee.type !== "Identifier" ||
        call.callee.name !== "v" ||
        call.arguments.length < 2 ||
        !isStringLiteral(call.arguments[0]!)
      ) {
        return { message: "", placeholders: [], valid: false }
      }

      const varName = (call.arguments[0] as StringLiteral).value
      placeholders.push(varName)
      parts.push(`{${varName}}`)
    }
  }

  const message = parts.join("").trim()
  return { message, placeholders, valid: message.length > 0 }
}
