import type { Argument, CallExpression, JSXChild, StringLiteral, TemplateLiteral } from "oxc-parser"
import { parseSync, Visitor } from "oxc-parser"

import type { ExtractedMessage } from "./types.js"

import { getMessageId } from "./message-id.js"

interface Markers {
  call: string[]
  component: string[]
  taggedTemplate: string[]
}

export function extractMessages(code: string, filename: string, markers: Markers): ExtractedMessage[] {
  const messages: ExtractedMessage[] = []
  const result = parseSync(filename, code)
  if (result.errors.length > 0) return messages

  const visitor = new Visitor({
    CallExpression(node) {
      if (
        node.callee.type === "Identifier" &&
        markers.call.includes(node.callee.name) &&
        node.arguments.length >= 1 &&
        isStringLiteral(node.arguments[0]!)
      ) {
        const value = (node.arguments[0] as StringLiteral).value
        messages.push({ id: value, defaultMessage: value, placeholders: [], file: filename })
      }
    },

    JSXElement(node) {
      const opening = node.openingElement
      if (opening.name.type !== "JSXIdentifier") return
      if (!markers.component.includes(opening.name.name)) return

      const extraction = extractJSXChildren(node.children)
      if (!extraction.valid) {
        console.warn(`[i18n] Non-static <${opening.name.name}> in ${filename}, skipping`)
        return
      }

      const id = getJSXStringAttribute(opening.attributes, "id") ?? getMessageId(extraction.message)
      messages.push({ id, defaultMessage: extraction.message, placeholders: extraction.placeholders, file: filename })
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
        console.warn(`[i18n] Non-static tagged template in ${filename}, skipping`)
        return
      }

      messages.push({ id, defaultMessage: extraction.message, placeholders: extraction.placeholders, file: filename })
    },
  })

  visitor.visit(result.program)
  return messages
}

function isStringLiteral(node: Argument): node is StringLiteral {
  return node.type === "Literal" && typeof (node as StringLiteral).value === "string"
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

        const varName = getJSXStringAttribute(child.openingElement.attributes as Array<unknown>, "name")
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
