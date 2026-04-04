import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Plugin } from "vite"

import type { I18nPluginOptions, MessageManifest, MessageManifestFile, RuntimeMessages, TranslateMessage, TranslationCache } from "./types.js"

import { getCacheKey, loadCache, saveCache } from "./cache.js"
import { extractComponentIdInsertions, extractMessages } from "./extractor.js"

const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const YELLOW = "\x1b[33m"
const BOLD = "\x1b[1m"
const CYAN = "\x1b[36m"
const HOSTED_API_BASE_URL = "https://better-translate.com"
const HOSTED_STUB = `${YELLOW}stub${RESET}`
const DEFAULT_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"]
const MANIFEST_FILENAME = "_manifest.json"

function formatLocale(locale: string) {
  return locale.toUpperCase()
}

function formatLocales(locales: string[]) {
  return locales.map(formatLocale).join(", ")
}

/** Scans source files for translatable messages and keeps locale files in sync. */
export function i18nExtractPlugin(options: I18nPluginOptions): Plugin {
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
  let cache: TranslationCache = { version: 1, entries: {} }
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
      messages[id] =
        locale === defaultLocale
          ? entry.defaultMessage
          : (cache.entries[getCacheKey(entry.defaultMessage, locale, entry.meta)]?.translation ?? entry.defaultMessage)
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

  function writeLocalesToDisk() {
    if (!shouldWriteLocalFiles) return
    const dir = resolve(root, localesDir)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    for (const locale of locales) {
      writeFileSync(resolve(dir, `${locale}.json`), JSON.stringify(buildRuntimeMessages(locale), null, 2) + "\n")
    }
    writeFileSync(resolve(dir, MANIFEST_FILENAME), JSON.stringify(buildMessageManifest(), null, 2) + "\n")
  }

  async function translateMissingMessages() {
    if (!resolvedTranslate) return false
    const missingByLocale = new Map<string, TranslateMessage[]>()

    for (const locale of locales) {
      if (locale === defaultLocale) continue
      for (const [id, entry] of Object.entries(manifest)) {
        if (!cache.entries[getCacheKey(entry.defaultMessage, locale, entry.meta)]) {
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
        cache.entries[getCacheKey(miss.text, locale, miss.meta)] = {
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
      if (!translated) return
      saveCache(resolve(root, cacheFile), cache)
      writeLocalesToDisk()
    }, 1000)
  }

  return {
    name: "i18n-extract",
    enforce: "pre",

    configResolved(config) {
      root = config.root
      isDev = config.command === "serve"
      scanRoots = (scan?.roots ?? ["src"]).map((scanRoot) => resolve(root, scanRoot))
      scanExtensions = scan?.extensions ?? DEFAULT_SCAN_EXTENSIONS
      if (shouldWriteLocalFiles) {
        process.env.I18N_LOCALES_DIR = resolve(root, localesDir)
      }
      log(
        `${PREFIX} ${BOLD}Better Translate${RESET} | Locales: ${CYAN}${formatLocales(locales)}${RESET} | Default: ${CYAN}${formatLocale(defaultLocale)}${RESET} | Storage: ${CYAN}${shouldWriteLocalFiles ? "Local" : "Hosted"}${RESET} | Out Dir: ${DIM}${shouldWriteLocalFiles ? localesDir : "n/a"}${RESET} | Scan: ${DIM}${(scan?.roots ?? ["src"]).join(", ")}${RESET}`,
      )
    },

    buildStart() {
      cache = loadCache(resolve(root, cacheFile))
    },

    configureServer(server) {
      if (!shouldWriteLocalFiles) return
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__i18n/")) return next()

        const locale = req.url.slice("/__i18n/".length).replace(/\.json$/, "")
        if (!locales.includes(locale)) return next()

        const filePath = resolve(root, localesDir, `${locale}.json`)
        res.setHeader("Content-Type", "application/json")
        res.end(existsSync(filePath) ? readFileSync(filePath, "utf-8") : "{}")
      })
    },

    transform(code, id) {
      const cleanId = id.split("?", 1)[0] ?? id
      if (!shouldScanFile(cleanId)) return

      for (const [key, entry] of Object.entries(manifest)) {
        entry.sources = entry.sources.filter((source) => source.file !== cleanId)
        if (entry.sources.length === 0) delete manifest[key]
      }

      const extracted = extractMessages(code, cleanId, {
        call: callMarkers,
        component: componentMarkers,
        taggedTemplate: taggedTemplateMarkers,
        logging,
      })

      for (const msg of extracted) {
        const existing = manifest[msg.id]
        if (existing && existing.defaultMessage !== msg.defaultMessage) {
          log(`${PREFIX} ${YELLOW}warn${RESET} conflicting messages for ${BOLD}"${msg.id}"${RESET}`)
        }
        if (existing && JSON.stringify(existing.meta) !== JSON.stringify(msg.meta)) {
          log(`${PREFIX} ${YELLOW}warn${RESET} conflicting contexts for ${BOLD}"${msg.id}"${RESET}`)
        }
        if (!existing) {
          manifest[msg.id] = {
            defaultMessage: msg.defaultMessage,
            meta: msg.meta,
            placeholders: msg.placeholders,
            sources: [],
          }
        }
        if (
          !manifest[msg.id]!.sources.some(
            (source) =>
              source.file === msg.source.file &&
              source.kind === msg.source.kind &&
              source.start === msg.source.start &&
              source.end === msg.source.end,
          )
        ) {
          manifest[msg.id]!.sources.push(msg.source)
        }
      }

      if (extracted.length > 0 && isDev) {
        writeLocalesToDisk()
        scheduleDevTranslation()
      }

      const insertions = extractComponentIdInsertions(code, cleanId, {
        call: callMarkers,
        component: componentMarkers,
        taggedTemplate: taggedTemplateMarkers,
        logging,
      })

      if (insertions.length === 0) return
      return {
        code: applyInsertions(code, insertions),
        map: null,
      }
    },

    async generateBundle() {
      await translateMissingMessages()

      writeLocalesToDisk()
      if (!shouldWriteLocalFiles) {
        await syncHosted()
      }

      if (shouldWriteLocalFiles) {
        for (const locale of locales) {
          this.emitFile({
            type: "asset",
            fileName: `${localesDir}/${locale}.json`,
            source: JSON.stringify(buildRuntimeMessages(locale), null, 2) + "\n",
          })
        }
        this.emitFile({
          type: "asset",
          fileName: `${localesDir}/${MANIFEST_FILENAME}`,
          source: JSON.stringify(buildMessageManifest(), null, 2) + "\n",
        })
      }
    },

    closeBundle() {
      saveCache(resolve(root, cacheFile), cache)
    },
  }
}

function applyInsertions(code: string, insertions: Array<{ id: string; start: number }>) {
  let transformed = code
  for (const insertion of [...insertions].sort((a, b) => b.start - a.start)) {
    transformed = `${transformed.slice(0, insertion.start)} id="${insertion.id}"${transformed.slice(insertion.start)}`
  }
  return transformed
}
