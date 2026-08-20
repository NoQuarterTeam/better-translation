import type { Argument, JSXChild, StringLiteral } from "oxc-parser"
import { parseSync, Visitor } from "oxc-parser"

import type { ExtractedMessage } from "../../types.js"

import { getMessageId } from "../../message/id.js"
import { isSupportedRichTextElement } from "../../message/rich-text.js"
import { analyzeFunctionMarker, type FunctionArgument, type FunctionProperty } from "./function-marker.js"
import {
  createSource,
  isValidPlaceholderName,
  type SourceAnalysis,
  type SourceDiagnostic,
  type SourceEdit,
  type SourceMarkers,
} from "./types.js"

/** Extracts messages and source edits from a TypeScript, JavaScript, or JSX file in one coordinated parse pass. */
export function analyzeTypeScriptSourceFile(code: string, filename: string, markers: SourceMarkers): SourceAnalysis {
  const messages: ExtractedMessage[] = []
  const edits: SourceEdit[] = []
  const diagnostics: SourceDiagnostic[] = []
  const result = parseSync(filename, code)
  if (result.errors.length > 0) return { parsed: false, messages, edits }

  const visitor = new Visitor({
    CallExpression(node) {
      const messageArgument = unwrapArgument(node.arguments[0])
      if (
        node.callee.type === "Identifier" &&
        markers.call.includes(node.callee.name) &&
        messageArgument &&
        isStringLiteral(messageArgument)
      ) {
        const result = analyzeFunctionMarker({
          marker: node.callee.name,
          message: messageArgument.value,
          second: normalizeFunctionArgument(code, node.arguments[1]),
          third: normalizeFunctionArgument(code, node.arguments[2]),
        })

        if (result.kind === "skip") {
          const argument = node.arguments[result.diagnostic.argument]!
          diagnostics.push({
            code: result.diagnostic.code,
            start: argument.start,
            end: argument.end,
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
          const argument = node.arguments[result.edit.argument]!
          const editArgument = result.edit.kind === "replace" ? unwrapArgument(argument)! : argument
          edits.push({
            start: result.edit.kind === "replace" ? editArgument.start : editArgument.end,
            end: editArgument.end,
            replacement: result.edit.replacement,
          })
        }
      }
    },

    JSXElement(node) {
      const opening = node.openingElement
      if (opening.name.type !== "JSXIdentifier") return
      if (!markers.component.includes(opening.name.name)) return
      const idAttribute = getJSXAttribute(opening.attributes as Array<unknown>, "id")
      const explicitId = getJSXStringAttribute(opening.attributes, "id")
      if (idAttribute && explicitId === undefined) {
        diagnostics.push({
          code: "dynamic-lookup-id",
          start: idAttribute.start,
          end: idAttribute.end,
          message: `Translation marker <${opening.name.name}> requires a static string id`,
        })
        return
      }

      const extraction = extractJSXChildren(code, node.children, markers.component)
      diagnostics.push(...extraction.diagnostics)
      if (!extraction.valid) {
        diagnostics.push({
          code: "non-static-message",
          start: node.start,
          end: node.end,
          message: `Translation marker <${opening.name.name}> must contain static Message content`,
        })
        if (markers.logging) {
          console.warn(`[better-translation] Non-static <${opening.name.name}> in ${filename}, skipping`)
        }
        return
      }
      edits.push(...extraction.edits)

      const context = getJSXStringAttribute(opening.attributes, "context")
      const meta = context ? { context } : undefined
      const id = explicitId ?? getMessageId(extraction.message, meta)
      messages.push({
        id,
        defaultMessage: extraction.message,
        meta: meta ?? {},
        placeholders: extraction.placeholders,
        source: createSource({
          filename,
          marker: opening.name.name,
          kind: "component",
        }),
      })

      if (!hasJSXAttribute(opening.attributes as Array<unknown>, "id")) {
        edits.push({
          start: opening.name.end,
          end: opening.name.end,
          replacement: ` id="${id}"`,
        })
      }

      if (!hasJSXAttribute(opening.attributes as Array<unknown>, "message")) {
        edits.push({
          start: opening.name.end,
          end: opening.name.end,
          replacement: ` message={${JSON.stringify(extraction.message)}}`,
        })
      }
    },
  })

  visitor.visit(result.program)
  return {
    parsed: true,
    messages,
    edits,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  }
}

function isStringLiteral(node: { type?: string; value?: unknown }): node is StringLiteral {
  return node.type === "Literal" && typeof (node as StringLiteral).value === "string"
}

function normalizeFunctionArgument(code: string, node?: Argument): FunctionArgument | undefined {
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
    properties: (argument.properties as Array<unknown>).map(normalizeFunctionProperty),
  }
}

function normalizeFunctionProperty(entry: unknown): FunctionProperty {
  const property = entry as
    | {
        type?: string
        computed?: boolean
        key?: { type?: string; name?: string; value?: unknown }
        value?: Argument
      }
    | undefined
  if ((property?.type !== "ObjectProperty" && property?.type !== "Property") || property.computed === true || !property.value) {
    return { kind: "opaque" }
  }

  const key = property.key?.type === "Identifier" ? property.key.name : property.key?.value
  if (typeof key !== "string") return { kind: "opaque" }

  const value = unwrapArgument(property.value)
  return {
    kind: "property",
    key,
    value: value && isStringLiteral(value) ? { kind: "string", value: value.value } : { kind: "dynamic" },
  }
}

function unwrapArgument(node?: Argument): Argument | undefined {
  let argument = node
  while (argument) {
    switch (argument.type) {
      case "ChainExpression":
      case "ParenthesizedExpression":
      case "TSAsExpression":
      case "TSInstantiationExpression":
      case "TSNonNullExpression":
      case "TSSatisfiesExpression":
      case "TSTypeAssertion":
        argument = argument.expression as Argument
        break
      default:
        return argument
    }
  }
}

function getJSXStringAttribute(attributes: Array<unknown>, name: string) {
  const attr = getJSXAttribute(attributes, name)
  if (attr?.value?.type === "Literal" && typeof attr.value.value === "string") return attr.value.value
  if (attr?.value?.type === "JSXExpressionContainer" && attr.value.expression && isStringLiteral(attr.value.expression)) {
    return attr.value.expression.value
  }
}

function getJSXAttribute(attributes: Array<unknown>, name: string) {
  return (
    attributes as Array<{
      type: string
      start: number
      end: number
      name?: { type: string; name?: string }
      value?: {
        type: string
        value?: unknown
        expression?: { type?: string; value?: unknown }
      } | null
    }>
  ).find((attr) => attr.type === "JSXAttribute" && attr.name?.type === "JSXIdentifier" && attr.name.name === name)
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

interface ExtractionResult {
  diagnostics: SourceDiagnostic[]
  edits: SourceEdit[]
  message: string
  placeholders: string[]
  valid: boolean
}

function extractJSXChildren(code: string, children: Array<JSXChild>, componentMarkers: string[]): ExtractionResult {
  const placeholders: string[] = []
  const edits: SourceEdit[] = []
  const diagnostics: SourceDiagnostic[] = []
  let nextRichTextElement = 0

  const extractChildren = (nestedChildren: Array<JSXChild>): string | undefined => {
    const parts: string[] = []

    for (const child of nestedChildren) {
      switch (child.type) {
        case "JSXText":
          parts.push(normalizeJSXText(child.value))
          break

        case "JSXElement": {
          const name = child.openingElement.name
          if (name.type === "JSXIdentifier" && name.name === "Var") {
            const entry = getVarEntry(code, child)
            if (!entry) return undefined
            if (!isValidPlaceholderName(entry.name)) {
              diagnostics.push({
                code: "invalid-placeholder-name",
                start: child.start,
                end: child.end,
                message: `Var name ${JSON.stringify(entry.name)} must only contain letters, numbers, or underscores`,
              })
              return undefined
            }

            const normalizationEdit = createVarNormalizationEdit(code, child, entry)
            if (normalizationEdit) edits.push(normalizationEdit)
            if (!placeholders.includes(entry.name)) placeholders.push(entry.name)
            parts.push(`{${entry.name}}`)
            break
          }

          if (name.type === "JSXIdentifier" && componentMarkers.includes(name.name)) return undefined
          if (name.type !== "JSXIdentifier" && name.type !== "JSXMemberExpression") {
            return undefined
          }
          if (name.type === "JSXIdentifier" && /^[a-z]/.test(name.name) && !isSupportedRichTextElement(name.name)) {
            return undefined
          }

          const index = nextRichTextElement++
          if (child.openingElement.selfClosing) {
            if (hasJSXAttribute(child.openingElement.attributes as Array<unknown>, "children")) return undefined
            parts.push(`<${index}/>`)
            break
          }

          const content = extractChildren(child.children)
          if (content === undefined) return undefined
          parts.push(`<${index}>${content}</${index}>`)
          break
        }

        case "JSXExpressionContainer":
          {
            const value = getStaticStringExpressionValue(child.expression)
            if (value !== undefined) {
              parts.push(value)
              break
            }
          }

          if (child.expression.type !== "JSXEmptyExpression") return undefined
          break

        case "JSXFragment": {
          const index = nextRichTextElement++
          const content = extractChildren(child.children)
          if (content === undefined) return undefined
          parts.push(`<${index}>${content}</${index}>`)
          break
        }

        default:
          return undefined
      }
    }

    return parts.join("")
  }

  const extracted = extractChildren(children)
  if (extracted === undefined) {
    return { diagnostics, edits: [], message: "", placeholders: [], valid: false }
  }
  const message = extracted.replace(/\s+/g, " ").trim()
  return { diagnostics, edits, message, placeholders, valid: message.length > 0 }
}

function getStaticStringExpressionValue(node: { type: string; value?: unknown }) {
  if (isStringLiteral(node)) return node.value
  if (node.type !== "TemplateLiteral") return undefined

  const template = node as unknown as {
    expressions?: unknown[]
    quasis?: Array<{ value?: { cooked?: unknown } }>
  }
  if (template.expressions?.length !== 0 || template.quasis?.length !== 1) return undefined
  return typeof template.quasis[0]?.value?.cooked === "string" ? template.quasis[0].value.cooked : undefined
}

function createVarNormalizationEdit(
  code: string,
  node: {
    start: number
    end: number
    openingElement: { attributes: Array<unknown> }
    children: Array<JSXChild>
  },
  entry: { name: string; value: string },
): SourceEdit | undefined {
  const explicitName = getJSXStringAttribute(node.openingElement.attributes, "name")
  const explicitValue = getJSXExpressionAttributeSource(code, node.openingElement.attributes, "value")
  const childValue = getVarChildrenSource(code, node.children)
  if (explicitName && (explicitValue || childValue)) return undefined

  return {
    start: node.start,
    end: node.end,
    replacement: `<Var name=${JSON.stringify(entry.name)} value={${entry.value}} />`,
  }
}

function normalizeJSXText(value: string) {
  const lines = value.split(/\r\n|\n|\r/)
  let lastNonEmptyLine = 0
  for (let index = 0; index < lines.length; index++) {
    if (lines[index]?.match(/[^ \t]/)) lastNonEmptyLine = index
  }

  return lines
    .map((sourceLine, index) => {
      let line = sourceLine.replace(/\t/g, " ")
      if (index !== 0) line = line.replace(/^ +/, "")
      if (index !== lines.length - 1) line = line.replace(/ +$/, "")
      return line && index !== lastNonEmptyLine ? `${line} ` : line
    })
    .join("")
}

function getVarEntry(
  code: string,
  node: { openingElement: { attributes: Array<unknown> }; children: Array<JSXChild> },
): { name: string; value: string } | undefined {
  const explicitName = getJSXStringAttribute(node.openingElement.attributes as Array<unknown>, "name")
  const explicitValue = getJSXExpressionAttributeSource(code, node.openingElement.attributes as Array<unknown>, "value")
  const childValue = getVarChildrenSource(code, node.children)
  if (explicitName && explicitValue) return { name: explicitName, value: explicitValue }
  if (explicitName && childValue) return { name: explicitName, value: childValue }
  if (explicitName) return { name: explicitName, value: JSON.stringify(explicitName) }

  const customProp = getSingleJSXAttributeEntry(code, node.openingElement.attributes as Array<unknown>)
  if (customProp) return customProp

  const childIdentifier = getVarChildIdentifier(node.children)
  return childIdentifier ? { name: childIdentifier, value: childIdentifier } : undefined
}

function getSingleJSXAttributeEntry(code: string, attributes: Array<unknown>): { name: string; value: string } | undefined {
  const keys = attributes.flatMap((attr) => {
    const attribute = attr as
      | {
          type?: string
          name?: { type?: string; name?: string }
          value?: { type?: string; value?: unknown; expression?: { start: number; end: number } } | null
        }
      | undefined

    if (
      attribute?.type !== "JSXAttribute" ||
      attribute.name?.type !== "JSXIdentifier" ||
      !attribute.name.name ||
      !isValidPlaceholderName(attribute.name.name)
    ) {
      return []
    }
    const value = getJSXAttributeValueSource(code, attribute.value)
    return value ? [{ name: attribute.name.name, value }] : []
  })

  return keys.length === 1 ? keys[0] : undefined
}

function getJSXExpressionAttributeSource(code: string, attributes: Array<unknown>, name: string) {
  for (const attr of attributes as Array<{
    type: string
    name?: { type: string; name?: string }
    value?: { type?: string; expression?: { start: number; end: number } } | null
  }>) {
    if (attr.type !== "JSXAttribute" || attr.name?.type !== "JSXIdentifier" || attr.name.name !== name) continue
    if (attr.value?.type !== "JSXExpressionContainer" || !attr.value.expression) return undefined
    return code.slice(attr.value.expression.start, attr.value.expression.end)
  }
}

function getJSXAttributeValueSource(
  code: string,
  value?: { type?: string; value?: unknown; expression?: { start: number; end: number } } | null,
) {
  if (!value) return undefined
  if (value.type === "JSXExpressionContainer" && value.expression) {
    return code.slice(value.expression.start, value.expression.end)
  }
  if (value.type === "Literal" && typeof value.value === "string") {
    return JSON.stringify(value.value)
  }
}

function getVarChildIdentifier(children: Array<JSXChild>) {
  const meaningfulChildren = children.filter((child) => !(child.type === "JSXText" && child.value.trim().length === 0))
  if (meaningfulChildren.length !== 1) return undefined

  const [child] = meaningfulChildren
  if (!child || child.type !== "JSXExpressionContainer" || child.expression.type !== "Identifier") return undefined
  return child.expression.name
}

function getVarChildrenSource(code: string, children: Array<JSXChild>) {
  const meaningfulChildren = children.filter((child) => !(child.type === "JSXText" && child.value.trim().length === 0))
  if (meaningfulChildren.length === 0) return undefined

  if (meaningfulChildren.length === 1) {
    const [child] = meaningfulChildren
    if (!child) return undefined
    if (child.type === "JSXExpressionContainer" && child.expression.type !== "JSXEmptyExpression") {
      return code.slice(child.expression.start, child.expression.end)
    }
  }

  const [first] = meaningfulChildren
  const last = meaningfulChildren.at(-1)
  if (!first || !last) return undefined
  return `<>${code.slice(first.start, last.end)}</>`
}
