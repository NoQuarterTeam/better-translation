import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import type { Plugin } from "vite"

import type {
  BetterTranslatePluginOptions,
  ExtractedMessage,
  ManifestEntry,
  MessageManifest,
  MessageManifestFile,
  MessageSource,
  RuntimeMessages,
  TranslateMessage,
  TranslationCache,
} from "./types.js"

import { createEmptyCache, getCacheKey, loadCache, saveCache } from "./cache.js"
import { analyzeSourceFile } from "./extractor.js"
import { serializeMeta } from "./message-id.js"

const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const YELLOW = "\x1b[33m"
const BOLD = "\x1b[1m"
const CYAN = "\x1b[36m"
const HOSTED_API_BASE_URL = "https://better-translate.com"
const HOSTED_STUB = `${YELLOW}stub${RESET}`
const DEFAULT_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"]
const PRIVATE_MANIFEST_FILENAME = ".better-translate-manifest.json"

function formatLocale(locale: string) {
  return locale.toUpperCase()
}

function formatLocales(locales: string[]) {
  return locales.map(formatLocale).join(", ")
}

/** Scans source files for translatable messages and keeps locale files in sync. */
export function betterTranslatePlugin(options: BetterTranslatePluginOptions): Plugin {
  const {
    locales,
    defaultLocale = locales[0] ?? "en",
    cacheFile = ".cache/better-translate.json",
    logging = true,
    scan,
    storage = { type: "hosted" },
    markers = {},
    translate,
  } = options
  const shouldWriteLocalFiles = storage.type === "local"
  const localesDir = storage.type === "local" ? (storage.dir ?? "locales") : "locales"
  const hostedUrl = storage.type === "hosted" ? (storage.url ?? HOSTED_API_BASE_URL) : HOSTED_API_BASE_URL

  const callMarkers = markers.call ?? ["t", "useT"]
  const componentMarkers = markers.component ?? ["T"]
  const taggedTemplateMarkers = markers.taggedTemplate ?? ["msg"]
  const manifest: MessageManifest = {}
  const fileMessages = new Map<string, ExtractedMessage[]>()
  let cache: TranslationCache = createEmptyCache()
  let root = ""
  let isDev = false
  let translateTimer: ReturnType<typeof setTimeout> | null = null
  let warnedHostedTranslateStub = false
  let warnedHostedSyncStub = false
  let scanRoots: string[] = []
  let scanExtensions: string[] = []

  function log(message: string) {
    if (logging) console.log(message)
  }

  async function hostedTranslate(messages: TranslateMessage[], _locale: string) {
    if (!warnedHostedTranslateStub) {
      warnedHostedTranslateStub = true
      log(`${PREFIX} ${HOSTED_STUB} hosted translate via ${DIM}${hostedUrl}${RESET} not implemented yet`)
    }
    return Object.fromEntries(messages.map((message) => [message.id, message.text])) as Record<string, string>
  }

  async function syncHosted() {
    if (!warnedHostedSyncStub) {
      warnedHostedSyncStub = true
      log(`${PREFIX} ${HOSTED_STUB} hosted locale sync via ${DIM}${hostedUrl}${RESET} not implemented yet`)
    }
  }

  const resolvedTranslate = translate ?? (shouldWriteLocalFiles ? undefined : hostedTranslate)

  function buildRuntimeMessages(locale: string): RuntimeMessages {
    const messages: RuntimeMessages = {}
    for (const [id, entry] of Object.entries(manifest)) {
      messages[id] = locale === defaultLocale ? entry.defaultMessage : (cache.entries[getCacheKey(id, locale)]?.translation ?? entry.defaultMessage)
    }
    return messages
  }

  function buildMessageManifest(): MessageManifestFile {
    return Object.fromEntries(
      Object.entries(manifest).map(([id, entry]) => [
        id,
        {
          defaultMessage: entry.defaultMessage,
          meta: entry.meta,
          placeholders: entry.placeholders,
          sources: entry.sources,
        },
      ]),
    )
  }

  function shouldScanFile(id: string) {
    const cleanId = id.split("?", 1)[0] ?? id
    if (cleanId.includes("node_modules")) return false
    const extension = scanExtensions.find((ext) => cleanId.endsWith(ext))
    if (!extension) return false
    return scanRoots.some((scanRoot) => cleanId.startsWith(scanRoot))
  }

  function getPrivateManifestPath() {
    return resolve(root, localesDir, PRIVATE_MANIFEST_FILENAME)
  }

  function writePrivateManifest() {
    if (!shouldWriteLocalFiles) return
    const path = getPrivateManifestPath()
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(path, JSON.stringify(buildMessageManifest(), null, 2) + "\n")
  }

  function writeLocalesToDisk() {
    if (!shouldWriteLocalFiles) return
    const dir = resolve(root, localesDir)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    for (const locale of locales) {
      writeFileSync(resolve(dir, `${locale}.json`), JSON.stringify(buildRuntimeMessages(locale), null, 2) + "\n")
    }
  }

  async function translateMissingMessages() {
    if (!resolvedTranslate) return false
    const missingByLocale = new Map<string, TranslateMessage[]>()

    for (const locale of locales) {
      if (locale === defaultLocale) continue
      for (const [id, entry] of Object.entries(manifest)) {
        if (!cache.entries[getCacheKey(id, locale)]) {
          const misses = missingByLocale.get(locale) ?? []
          misses.push({
            id,
            text: entry.defaultMessage,
            meta: entry.meta,
            placeholders: entry.placeholders,
            sources: entry.sources,
          })
          missingByLocale.set(locale, misses)
        }
      }
    }

    const totalMisses = [...missingByLocale.values()].reduce((count, misses) => count + misses.length, 0)
    if (totalMisses === 0) return false

    const missLocales = [...missingByLocale.keys()]
    log(
      `${PREFIX} ${BOLD}Translating${RESET} ${CYAN}${totalMisses}${RESET} ${totalMisses === 1 ? "Message" : "Messages"} -> ${CYAN}${formatLocales(missLocales)}${RESET}`,
    )

    for (const [locale, misses] of missingByLocale) {
      const result = await resolvedTranslate(misses, locale)

      for (const miss of misses) {
        const translated = result[miss.id] ?? miss.text
        cache.entries[getCacheKey(miss.id, locale)] = {
          sourceText: miss.text,
          meta: miss.meta,
          locale,
          translation: translated,
          timestamp: Date.now(),
        }
      }
    }

    return true
  }

  function scheduleDevTranslation() {
    if (!resolvedTranslate) return
    if (!isDev) return
    if (translateTimer) clearTimeout(translateTimer)
    translateTimer = setTimeout(async () => {
      const translated = await translateMissingMessages()
      if (translated) saveCache(resolve(root, cacheFile), cache)
      writeLocalesToDisk()
      writePrivateManifest()
    }, 1000)
  }

  function removeFileMessages(file: string) {
    const previous = fileMessages.get(file)
    if (!previous) return false

    for (const message of previous) {
      const entry = manifest[message.id]
      if (!entry) continue
      entry.sources = entry.sources.filter((source) => !isSameSource(source, message.source))
      if (entry.sources.length === 0) delete manifest[message.id]
    }

    fileMessages.delete(file)
    return true
  }

  function syncFileMessages(file: string, messages: ExtractedMessage[]) {
    const nextEntries = groupMessagesById(messages)
    for (const [id, entry] of Object.entries(nextEntries)) {
      const existing = manifest[id]
      if (existing && !hasSameMessageShape(existing, entry)) {
        throw new Error(formatCollisionError(id, existing, entry))
      }
    }

    const hadPreviousMessages = removeFileMessages(file)
    for (const [id, entry] of Object.entries(nextEntries)) {
      if (!manifest[id]) {
        manifest[id] = entry
        continue
      }
      for (const source of entry.sources) {
        if (!manifest[id]!.sources.some((existingSource) => isSameSource(existingSource, source))) {
          manifest[id]!.sources.push(source)
        }
      }
    }

    if (messages.length > 0) fileMessages.set(file, messages)
    return hadPreviousMessages || messages.length > 0
  }

  function toRootRelativePath(file: string) {
    return relative(root, file).replaceAll("\\", "/")
  }

  return {
    name: "better-translate-extract",
    enforce: "pre",

    configResolved(config) {
      root = config.root
      isDev = config.command === "serve"
      scanRoots = (scan?.roots ?? ["src"]).map((scanRoot) => resolve(root, scanRoot))
      scanExtensions = scan?.extensions ?? DEFAULT_SCAN_EXTENSIONS
      log(
        `${PREFIX} ${BOLD}Better Translate${RESET} | Locales: ${CYAN}${formatLocales(locales)}${RESET} | Default: ${CYAN}${formatLocale(defaultLocale)}${RESET} | Storage: ${CYAN}${shouldWriteLocalFiles ? "Local" : "Hosted"}${RESET} | Out Dir: ${DIM}${shouldWriteLocalFiles ? localesDir : "n/a"}${RESET} | Scan: ${DIM}${(scan?.roots ?? ["src"]).join(", ")}${RESET}`,
      )
    },

    buildStart() {
      cache = loadCache(resolve(root, cacheFile))
    },

    transform(code, id) {
      const cleanId = id.split("?", 1)[0] ?? id
      if (!shouldScanFile(cleanId)) return

      const analysis = analyzeSourceFile(code, cleanId, {
        call: callMarkers,
        component: componentMarkers,
        taggedTemplate: taggedTemplateMarkers,
        logging,
      })
      const manifestChanged = syncFileMessages(
        cleanId,
        analysis.messages.map((message) => ({
          ...message,
          source: {
            ...message.source,
            file: toRootRelativePath(message.source.file),
          },
        })),
      )

      if (manifestChanged && isDev) {
        writeLocalesToDisk()
        writePrivateManifest()
        scheduleDevTranslation()
      }

      if (analysis.edits.length === 0) return
      return {
        code: applyEdits(code, analysis.edits),
        map: null,
      }
    },

    async generateBundle() {
      await translateMissingMessages()

      writeLocalesToDisk()
      writePrivateManifest()
      if (shouldWriteLocalFiles) {
        for (const locale of locales) {
          this.emitFile({
            type: "asset",
            fileName: `${localesDir}/${locale}.json`,
            source: JSON.stringify(buildRuntimeMessages(locale), null, 2) + "\n",
          })
        }
      } else {
        await syncHosted()
      }
    },

    closeBundle() {
      saveCache(resolve(root, cacheFile), cache)
    },
  }
}

function applyEdits(code: string, edits: Array<{ start: number; end: number; replacement: string }>) {
  let transformed = code
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    transformed = `${transformed.slice(0, edit.start)}${edit.replacement}${transformed.slice(edit.end)}`
  }
  return transformed
}

function groupMessagesById(messages: ExtractedMessage[]): MessageManifest {
  const grouped: MessageManifest = {}

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
  return (
    left.file === right.file &&
    left.kind === right.kind &&
    left.marker === right.marker &&
    left.start === right.start &&
    left.end === right.end
  )
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
  return sources.map((source) => `${source.file}:${source.line}:${source.column}`).join(", ")
}
