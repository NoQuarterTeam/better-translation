import { relative } from "node:path"
import { normalizePath } from "vite"

import type { ExtractedMessage, ManifestEntry, MessageManifest, MessageManifestFile, MessageSource } from "../types.js"

import { serializeMeta } from "../message/id.js"
import { analyzeSourceFile, type SourceAnalysis } from "./source-analysis/index.js"

const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const CALL_MARKERS = ["t", "useT"]
const COMPONENT_MARKERS = ["T"]

export interface ManifestSyncResult {
  manifestChanged: boolean
  localeMessagesChanged: boolean
}

export class ManifestState {
  readonly manifest: MessageManifest = createMessageManifest()

  readonly #fileMessages = new Map<string, ExtractedMessage[]>()
  readonly #sourceAnalyses = new Map<string, { analysis: SourceAnalysis; code: string }>()
  #cachedSnapshot: MessageManifestFile | null = null

  constructor(
    private readonly root: string,
    private readonly logging: boolean,
  ) {}

  analyze(file: string, code: string) {
    const normalizedFile = normalizePath(file)
    const cachedAnalysis = this.#sourceAnalyses.get(normalizedFile)
    if (cachedAnalysis?.code === code) return cachedAnalysis.analysis

    const analysis = analyzeSourceFile(code, file, {
      call: CALL_MARKERS,
      component: COMPONENT_MARKERS,
      logging: false,
    })
    this.#sourceAnalyses.set(normalizedFile, { analysis, code })
    if (this.logging) {
      for (const diagnostic of analysis.diagnostics ?? []) {
        console.warn(`${PREFIX} ${diagnostic.message} in ${this.#toRootRelativePath(file)}:${diagnostic.start}-${diagnostic.end}`)
      }
    }
    return analysis
  }

  sync(file: string, code: string) {
    const analysis = this.analyze(file, code)
    if (!analysis.parsed) return null

    const result = this.#replaceFileMessages(
      normalizePath(file),
      analysis.messages.map((message) => ({
        ...message,
        source: {
          ...message.source,
          file: this.#toRootRelativePath(message.source.file),
        },
      })),
    )
    if (result.manifestChanged) this.#cachedSnapshot = null
    return result
  }

  remove(file: string): ManifestSyncResult {
    const normalizedFile = normalizePath(file)
    this.#sourceAnalyses.delete(normalizedFile)
    const hadPreviousMessages = this.#removeFileMessages(normalizedFile)
    if (hadPreviousMessages) this.#cachedSnapshot = null
    return {
      manifestChanged: hadPreviousMessages,
      localeMessagesChanged: hadPreviousMessages,
    }
  }

  reset() {
    if (Object.keys(this.manifest).length > 0) this.#cachedSnapshot = null
    for (const id of Object.keys(this.manifest)) delete this.manifest[id]
    this.#fileMessages.clear()
    this.#sourceAnalyses.clear()
  }

  snapshot(): MessageManifestFile {
    if (this.#cachedSnapshot) return this.#cachedSnapshot

    this.#cachedSnapshot = Object.fromEntries(
      Object.entries(this.manifest)
        .sort(compareManifestEntryIds)
        .map(([id, entry]) => [
          id,
          {
            defaultMessage: entry.defaultMessage,
            meta: entry.meta,
            placeholders: entry.placeholders,
            sources: entry.sources.length > 1 ? [...entry.sources].sort(compareMessageSources) : [...entry.sources],
          },
        ]),
    )
    return this.#cachedSnapshot
  }

  #replaceFileMessages(file: string, messages: ExtractedMessage[]): ManifestSyncResult {
    const previousMessages = this.#fileMessages.get(file) ?? []
    const manifestChanged = !haveSameMessages(previousMessages, messages, getExtractedMessageKey)
    const localeMessagesChanged = !haveSameMessages(previousMessages, messages, getMessageIdentityKey)
    if (!manifestChanged) {
      if (messages.length > 0) this.#fileMessages.set(file, messages)
      return { manifestChanged, localeMessagesChanged }
    }

    const nextEntries = groupMessagesById(messages)
    for (const [id, entry] of Object.entries(nextEntries)) {
      const existing = this.manifest[id]
      const hasOtherSource =
        existing?.sources.some(
          (source) => !previousMessages.some((previousMessage) => isSameSource(source, previousMessage.source)),
        ) ?? false
      if (existing && hasOtherSource && !hasSameMessageShape(existing, entry)) {
        throw new Error(formatCollisionError(id, existing, entry))
      }
    }

    this.#removeFileMessages(file)
    for (const [id, entry] of Object.entries(nextEntries)) {
      if (!this.manifest[id]) {
        this.manifest[id] = entry
        continue
      }
      // Contributions from this file were removed above, so these source keys cannot already exist.
      this.manifest[id].sources.push(...entry.sources)
    }

    if (messages.length > 0) this.#fileMessages.set(file, messages)
    return { manifestChanged, localeMessagesChanged }
  }

  #removeFileMessages(file: string) {
    const previous = this.#fileMessages.get(file)
    if (!previous) return false

    const sourceKeysById = new Map<string, Set<string>>()
    for (const message of previous) {
      const sourceKeys = sourceKeysById.get(message.id) ?? new Set<string>()
      sourceKeys.add(getSourceKey(message.source))
      sourceKeysById.set(message.id, sourceKeys)
    }

    for (const [id, sourceKeys] of sourceKeysById) {
      const entry = this.manifest[id]
      if (!entry) continue
      entry.sources = entry.sources.filter((source) => !sourceKeys.has(getSourceKey(source)))
      if (entry.sources.length === 0) delete this.manifest[id]
    }

    this.#fileMessages.delete(file)
    return true
  }

  #toRootRelativePath(file: string) {
    return relative(this.root, file).replaceAll("\\", "/")
  }
}

function groupMessagesById(messages: ExtractedMessage[]): MessageManifest {
  const grouped = createMessageManifest()

  for (const message of messages) {
    const existing = grouped[message.id]
    if (existing && !hasSameMessageShape(existing, message)) {
      throw new Error(formatCollisionError(message.id, existing, message))
    }
    if (!existing) {
      grouped[message.id] = {
        defaultMessage: message.defaultMessage,
        meta: message.meta,
        placeholders: message.placeholders,
        sources: [message.source],
      }
      continue
    }
    if (!existing.sources.some((source) => isSameSource(source, message.source))) {
      existing.sources.push(message.source)
    }
  }

  return grouped
}

function createMessageManifest() {
  return Object.create(null) as MessageManifest
}

function hasSameMessageShape(
  existing: Pick<ManifestEntry, "defaultMessage" | "meta" | "placeholders">,
  incoming: Pick<ManifestEntry, "defaultMessage" | "meta" | "placeholders"> | ExtractedMessage,
) {
  return (
    existing.defaultMessage === incoming.defaultMessage &&
    serializeMeta(existing.meta) === serializeMeta(incoming.meta) &&
    JSON.stringify(existing.placeholders) === JSON.stringify(incoming.placeholders)
  )
}

function isSameSource(left: MessageSource, right: MessageSource) {
  return left.file === right.file && left.kind === right.kind && left.marker === right.marker
}

function getSourceKey(source: MessageSource) {
  return `${source.file}\0${source.kind}\0${source.marker}`
}

function haveSameMessages(left: ExtractedMessage[], right: ExtractedMessage[], getKey: (message: ExtractedMessage) => string) {
  if (left.length !== right.length) return false

  const remaining = new Map<string, number>()
  for (const message of left) {
    const key = getKey(message)
    remaining.set(key, (remaining.get(key) ?? 0) + 1)
  }
  for (const message of right) {
    const key = getKey(message)
    const count = remaining.get(key)
    if (count === undefined) return false
    if (count === 1) remaining.delete(key)
    else remaining.set(key, count - 1)
  }
  return remaining.size === 0
}

function getExtractedMessageKey(message: ExtractedMessage) {
  return JSON.stringify([getMessageIdentityKey(message), message.source.file, message.source.kind, message.source.marker])
}

function getMessageIdentityKey(message: ExtractedMessage) {
  return JSON.stringify([message.id, message.defaultMessage, serializeMeta(message.meta), message.placeholders])
}

function compareManifestEntryIds([left]: [string, ManifestEntry], [right]: [string, ManifestEntry]) {
  return left.localeCompare(right)
}

function compareMessageSources(left: MessageSource, right: MessageSource) {
  return left.file.localeCompare(right.file) || left.kind.localeCompare(right.kind) || left.marker.localeCompare(right.marker)
}

function formatCollisionError(
  id: string,
  existing: Pick<ManifestEntry, "defaultMessage" | "meta" | "placeholders" | "sources">,
  incoming: Pick<ManifestEntry, "defaultMessage" | "meta" | "placeholders" | "sources"> | ExtractedMessage,
) {
  const existingSources = formatSources(existing.sources)
  const incomingSources = formatSources("source" in incoming ? [incoming.source] : incoming.sources)
  return [
    `${PREFIX} conflicting message definition for ${BOLD}"${id}"${RESET}`,
    `existing: ${JSON.stringify({ defaultMessage: existing.defaultMessage, meta: existing.meta, placeholders: existing.placeholders })}`,
    `existing sources: ${existingSources}`,
    `incoming: ${JSON.stringify({ defaultMessage: incoming.defaultMessage, meta: incoming.meta, placeholders: incoming.placeholders })}`,
    `incoming sources: ${incomingSources}`,
  ].join("\n")
}

function formatSources(sources: MessageSource[]) {
  return sources.map((source) => `${source.file} (${source.kind}:${source.marker})`).join(", ")
}
