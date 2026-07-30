import type { TranslateOptions } from "../../types.js"

import { getCallMessageId } from "../../message/id.js"
import { getMessagePlaceholderNames } from "../../message/template.js"

export type FunctionProperty =
  | {
      kind: "property"
      key: string
      value: { kind: "string"; value: string } | { kind: "dynamic" }
    }
  | { kind: "opaque" }

export type FunctionArgument =
  | { kind: "string"; value: string; source: string }
  | { kind: "object"; source: string; properties: readonly FunctionProperty[] }
  | { kind: "opaque" }

type FunctionOptionsArgument = Exclude<FunctionArgument, { kind: "opaque" }>

export interface FunctionMarkerInput {
  marker: string
  message: string
  second?: FunctionArgument
  third?: FunctionArgument
}

export type FunctionMarkerResult =
  | {
      kind: "skip"
      diagnostic: {
        argument: 1 | 2
        code: "ambiguous-call-arguments" | "dynamic-lookup-id"
        message: string
      }
    }
  | {
      kind: "message"
      id: string
      defaultMessage: string
      meta: TranslateOptions
      placeholders: string[]
      edit?:
        | { kind: "insert-after"; argument: 0 | 1; replacement: string }
        | { kind: "replace"; argument: 1 | 2; replacement: string }
    }

/**
 * Resolves the shared semantics of a function Translation marker after a
 * source-analysis adapter has normalized its syntax-specific arguments.
 */
export function analyzeFunctionMarker({ marker, message, second, third }: FunctionMarkerInput): FunctionMarkerResult {
  const placeholders = getMessagePlaceholderNames(message)
  const placeholderSet = new Set(placeholders)

  let options: FunctionOptionsArgument | undefined
  let optionsIndex: 1 | 2 | undefined
  let valuesIndex: 1 | undefined

  if (third) {
    if (!isSafeOptionsArgument(third)) return ambiguous(marker, 2)
    options = third
    optionsIndex = 2
    valuesIndex = 1
  } else if (second) {
    if (second.kind === "opaque") return ambiguous(marker, 1)
    const classification = classifySecondArgument(second, placeholderSet)
    if (classification === "ambiguous") return ambiguous(marker, 1)
    if (classification === "options") {
      options = second
      optionsIndex = 1
    } else {
      valuesIndex = 1
    }
  }

  const optionsAnalysis = analyzeOptions(options)
  if (optionsAnalysis.dynamicId) {
    return {
      kind: "skip",
      diagnostic: {
        argument: optionsIndex!,
        code: "dynamic-lookup-id",
        message: `Function Translation marker ${marker}() requires a static string id`,
      },
    }
  }

  const meta = optionsAnalysis.meta
  const id = getCallMessageId(message, meta)
  const result: FunctionMarkerResult = {
    kind: "message",
    id,
    defaultMessage: message,
    meta,
    placeholders,
  }

  if (optionsAnalysis.explicitId) return result

  if (!options || optionsIndex === undefined) {
    result.edit = {
      kind: "insert-after",
      argument: valuesIndex ?? 0,
      replacement: `, { id: ${JSON.stringify(id)} }`,
    }
    return result
  }

  if (options.kind === "string") {
    result.edit = {
      kind: "replace",
      argument: optionsIndex,
      replacement: `{ id: ${JSON.stringify(id)}, context: ${options.source} }`,
    }
    return result
  }

  const inner = options.source.slice(1, -1).trim()
  result.edit = {
    kind: "replace",
    argument: optionsIndex,
    replacement: inner ? `{ id: ${JSON.stringify(id)}, ${inner} }` : `{ id: ${JSON.stringify(id)} }`,
  }
  return result
}

function classifySecondArgument(argument: FunctionOptionsArgument, placeholders: Set<string>) {
  if (argument.kind === "string") return "options"

  const isOptions = argument.properties.every(
    (property) =>
      property.kind === "property" && (property.key === "context" || property.key === "id") && !placeholders.has(property.key),
  )
  if (isOptions) return "options"

  const hasKnownValue = argument.properties.some(
    (property) =>
      property.kind === "property" && ((property.key !== "context" && property.key !== "id") || placeholders.has(property.key)),
  )
  return hasKnownValue ? "values" : "ambiguous"
}

function isSafeOptionsArgument(argument: FunctionArgument): argument is FunctionOptionsArgument {
  return (
    argument.kind === "string" ||
    (argument.kind === "object" && argument.properties.every((property) => property.kind === "property"))
  )
}

function analyzeOptions(argument?: FunctionArgument) {
  if (!argument) return { dynamicId: false, explicitId: false, meta: {} }
  if (argument.kind === "string") {
    return { dynamicId: false, explicitId: false, meta: { context: argument.value } }
  }
  if (argument.kind !== "object") return { dynamicId: false, explicitId: false, meta: {} }

  const meta: TranslateOptions = {}
  let dynamicId = false
  let explicitId = false

  for (const property of argument.properties) {
    if (property.kind !== "property" || (property.key !== "context" && property.key !== "id")) continue

    if (property.value.kind === "string") {
      meta[property.key] = property.value.value
      if (property.key === "id") {
        dynamicId = false
        explicitId = true
      }
      continue
    }

    delete meta[property.key]
    if (property.key === "id") {
      dynamicId = true
      explicitId = false
    }
  }

  return { dynamicId, explicitId, meta }
}

function ambiguous(marker: string, argument: 1 | 2): FunctionMarkerResult {
  return {
    kind: "skip",
    diagnostic: {
      argument,
      code: "ambiguous-call-arguments",
      message: `Function Translation marker ${marker}() cannot statically resolve its values or options`,
    },
  }
}
