import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Plugin } from "vite"

import type { I18nPluginOptions, MessageManifest, TranslationCache } from "./types.js"

import { getCacheKey, loadCache, saveCache } from "./cache.js"
import { extractMessages } from "./extractor.js"

const PREFIX = "\x1b[36m[i18n]\x1b[0m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const BOLD = "\x1b[1m"
const CYAN = "\x1b[36m"
const HOSTED_API_BASE_URL = "https://better-translate.com"
const HOSTED_STUB = `${YELLOW}stub${RESET}`
const DEFAULT_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"]

export function i18nExtractPlugin(options: I18nPluginOptions): Plugin {
  const {
    locales,
    defaultLocale = locales[0] ?? "en",
    cacheFile = ".cache/i18n-translations.json",
    scan,
    storage = { type: "hosted" },
    markers = {},
    translate,
  } = options
  const shouldWriteLocalFiles = storage.type === "local"
  const localesDir = storage.type === "local" ? (storage.dir ?? "locales") : "locales"
  const hostedUrl = storage.type === "hosted" ? (storage.url ?? HOSTED_API_BASE_URL) : HOSTED_API_BASE_URL

  const callMarkers = markers.call ?? []
  const componentMarkers = markers.component ?? ["T"]
  const taggedTemplateMarkers = markers.taggedTemplate ?? ["msg"]
  const manifest: MessageManifest = {}
  let cache: TranslationCache = { version: 1, entries: {} }
  let root = ""
  let filesScanned = 0
  let isDev = false
  let translateTimer: ReturnType<typeof setTimeout> | null = null
  let warnedHostedTranslateStub = false
  let warnedHostedSyncStub = false
  let scanRoots: string[] = []
  let scanExtensions: string[] = []

  async function hostedTranslate(messages: Record<string, string>, _locale: string) {
    if (!warnedHostedTranslateStub) {
      warnedHostedTranslateStub = true
      console.log(`${PREFIX} ${HOSTED_STUB} hosted translate via ${DIM}${hostedUrl}${RESET} not implemented yet`)
    }
    return Object.fromEntries(Object.entries(messages).map(([id, text]) => [id, text])) as Record<string, string>
  }

  async function syncHosted() {
    if (!warnedHostedSyncStub) {
      warnedHostedSyncStub = true
      console.log(`${PREFIX} ${HOSTED_STUB} hosted locale sync via ${DIM}${hostedUrl}${RESET} not implemented yet`)
    }
  }

  const resolvedTranslate = translate ?? (shouldWriteLocalFiles ? undefined : hostedTranslate)

  function buildLocaleMap(locale: string): Record<string, string> {
    const translations: Record<string, string> = {}
    for (const [id, entry] of Object.entries(manifest)) {
      if (locale === defaultLocale) {
        translations[id] = entry.defaultMessage
      } else {
        const key = getCacheKey(entry.defaultMessage, locale)
        translations[id] = cache.entries[key]?.translation ?? entry.defaultMessage
      }
    }
    return translations
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
      writeFileSync(resolve(dir, `${locale}.json`), JSON.stringify(buildLocaleMap(locale), null, 2) + "\n")
    }
  }

  async function translateMissingMessages() {
    if (!resolvedTranslate) return false
    const allMisses: { locale: string; id: string; text: string }[] = []

    for (const locale of locales) {
      if (locale === defaultLocale) continue
      for (const [id, entry] of Object.entries(manifest)) {
        if (!cache.entries[getCacheKey(entry.defaultMessage, locale)]) {
          allMisses.push({ locale, id, text: entry.defaultMessage })
        }
      }
    }

    if (allMisses.length === 0) return false

    const missLocales = [...new Set(allMisses.map((m) => m.locale))]
    console.log(
      `${PREFIX} translating ${BOLD}${allMisses.length}${RESET} messages to ${CYAN}${missLocales.join(", ")}${RESET}...`,
    )

    for (const miss of allMisses) {
      const result = await resolvedTranslate({ [miss.id]: miss.text }, miss.locale)
      const translated = result[miss.id] ?? miss.text
      cache.entries[getCacheKey(miss.text, miss.locale)] = {
        sourceText: miss.text,
        locale: miss.locale,
        translation: translated,
        timestamp: Date.now(),
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
      console.log(`${PREFIX} ${GREEN}done${RESET} — wrote ${BOLD}${locales.length}${RESET} locale files`)
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
      console.log(`\n${PREFIX} ${BOLD}i18n extraction plugin${RESET}`)
      console.log(`${PREFIX} locales: ${CYAN}${locales.join(", ")}${RESET}  default: ${CYAN}${defaultLocale}${RESET}`)
      console.log(`${PREFIX} scan: ${DIM}${(scan?.roots ?? ["src"]).join(", ")}${RESET}`)
      console.log(
        `${PREFIX} storage: ${
          shouldWriteLocalFiles
            ? `${DIM}${localesDir}/${RESET}`
            : `${CYAN}hosted${RESET}${storage.type === "hosted" && storage.url ? ` ${DIM}(${storage.url})${RESET}` : ""}`
        }`,
      )
    },

    buildStart() {
      cache = loadCache(resolve(root, cacheFile))
      const cachedCount = Object.keys(cache.entries).length
      if (cachedCount > 0) {
        console.log(`${PREFIX} cache: ${GREEN}${cachedCount}${RESET} translations cached`)
      }
      filesScanned = 0
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

      const rel = cleanId.startsWith(root) ? cleanId.slice(root.length + 1) : cleanId

      for (const [key, entry] of Object.entries(manifest)) {
        entry.files = entry.files.filter((f) => f !== cleanId)
        if (entry.files.length === 0) delete manifest[key]
      }

      const extracted = extractMessages(code, cleanId, {
        call: callMarkers,
        component: componentMarkers,
        taggedTemplate: taggedTemplateMarkers,
      })

      if (extracted.length > 0) {
        filesScanned++
        if (isDev) {
          console.log(`${PREFIX} ${DIM}${rel}${RESET} ${GREEN}${extracted.length}${RESET} messages`)
        }
      }

      for (const msg of extracted) {
        const existing = manifest[msg.id]
        if (existing && existing.defaultMessage !== msg.defaultMessage) {
          console.log(`${PREFIX} ${YELLOW}warn${RESET} conflicting messages for ${BOLD}"${msg.id}"${RESET}`)
        }
        if (!existing) {
          manifest[msg.id] = { defaultMessage: msg.defaultMessage, placeholders: msg.placeholders, files: [] }
        }
        if (!manifest[msg.id]!.files.includes(msg.file)) {
          manifest[msg.id]!.files.push(msg.file)
        }
      }

      if (extracted.length > 0 && isDev) {
        writeLocalesToDisk()
        scheduleDevTranslation()
      }
    },

    async generateBundle() {
      const messageCount = Object.keys(manifest).length
      console.log(
        `\n${PREFIX} ${GREEN}extracted${RESET} ${BOLD}${messageCount}${RESET} messages from ${BOLD}${filesScanned}${RESET} files`,
      )

      const start = performance.now()
      const translated = await translateMissingMessages()
      if (translated) {
        const ms = Math.round(performance.now() - start)
        console.log(` ${GREEN}done${RESET} ${DIM}(${ms}ms)${RESET}`)
      }

      writeLocalesToDisk()
      if (!shouldWriteLocalFiles) {
        await syncHosted()
      }

      if (shouldWriteLocalFiles) {
        for (const locale of locales) {
          this.emitFile({
            type: "asset",
            fileName: `${localesDir}/${locale}.json`,
            source: JSON.stringify(buildLocaleMap(locale), null, 2) + "\n",
          })
        }
      }

      console.log(
        `${PREFIX} ${GREEN}done${RESET} ${
          shouldWriteLocalFiles
            ? `wrote ${BOLD}${locales.length}${RESET} locale files to ${DIM}${localesDir}/${RESET}`
            : `prepared ${BOLD}${locales.length}${RESET} locales for ${CYAN}hosted${RESET}`
        }\n`,
      )
    },

    closeBundle() {
      saveCache(resolve(root, cacheFile), cache)
    },
  }
}
