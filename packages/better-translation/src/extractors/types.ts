import type { ExtractedMessage, MessageSource } from "../types.js"

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

export interface SourceAnalysis {
  parsed: boolean
  messages: ExtractedMessage[]
  edits: SourceEdit[]
}

export function extractPlaceholdersFromMessage(message: string) {
  const names = new Set<string>()
  for (const match of message.matchAll(/\{(\w+)\}/g)) {
    if (match[1]) names.add(match[1])
  }
  return [...names]
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
