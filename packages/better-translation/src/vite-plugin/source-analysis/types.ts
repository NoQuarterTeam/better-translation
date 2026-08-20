import type { ExtractedMessage, MessageSource } from "../../types.js"

import { getMessagePlaceholderNames } from "../../message/template.js"

export { isValidPlaceholderName } from "../../message/template.js"

export interface SourceMarkers {
  call: string[]
  component: string[]
  logging: boolean
}

export interface SourceEdit {
  start: number
  end: number
  replacement: string
}

export interface SourceDiagnostic {
  code: "ambiguous-call-arguments" | "dynamic-lookup-id" | "invalid-placeholder-name" | "non-static-message"
  start: number
  end: number
  message: string
}

export interface SourceAnalysis {
  parsed: boolean
  messages: ExtractedMessage[]
  edits: SourceEdit[]
  diagnostics?: SourceDiagnostic[]
}

export function recordPlaceholder(
  placeholders: string[],
  values: Array<{ name: string; value: string }>,
  entry: { name: string; value: string },
) {
  const index = placeholders.indexOf(entry.name)
  if (index === -1) {
    placeholders.push(entry.name)
    values.push(entry)
    return
  }
  values[index] = entry
}

export function formatPlaceholderValues(values: Array<{ name: string; value: string }>) {
  return values
    .map((entry) => {
      const key =
        entry.name === "__proto__"
          ? `[${JSON.stringify(entry.name)}]`
          : /^[A-Za-z_$][\w$]*$/.test(entry.name)
            ? entry.name
            : JSON.stringify(entry.name)
      return `${key}: ${entry.value}`
    })
    .join(", ")
}

export function extractPlaceholdersFromMessage(message: string) {
  return getMessagePlaceholderNames(message)
}

export function createSource({
  filename,
  marker,
  kind,
}: {
  filename: string
  marker: string
  kind: MessageSource["kind"]
}): MessageSource {
  return {
    file: filename,
    kind,
    marker,
  }
}
