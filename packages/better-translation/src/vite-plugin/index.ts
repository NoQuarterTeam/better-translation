import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { normalizePath, type Plugin, type ResolvedConfig, type ViteDevServer } from "vite"

import type {
  BetterTranslatePluginOptions,
  BetterTranslateRuntimeOptions,
  ManifestEntry,
  RuntimeMessages,
  TranslateFn,
  TranslateMessage,
  TranslationCache,
} from "../types.js"

import { serializeMeta } from "../message/id.js"
import { hasSameMessageStructure } from "../message/template.js"
import { getOwnValue } from "../message/value-record.js"
import { LOCALE_VALUES_HOT_UPDATE_EVENT } from "../runtime/hot-locale-values.js"
import { createEmptyCache, getCacheKey, loadCache, saveCache } from "./cache.js"
import { configureLocalEditor, getLocalEditorOptions } from "./local-editor/server.js"
import { ManifestState, type ManifestSyncResult } from "./manifest-state.js"

const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const CYAN = "\x1b[36m"
const REMOTE_API_BASE_URL = "https://better-translation.vercel.app"
const DEFAULT_REMOTE_API_KEY_ENV = "BETTER_TRANSLATION_API_KEY"
const DEFAULT_REMOTE_BRANCH = "main"
const DEFAULT_CACHE_DIR = ".cache/better-translation"
const DEFAULT_TRANSLATION_CACHE_FILE = `${DEFAULT_CACHE_DIR}/cache.json`
const DEFAULT_PRIVATE_MANIFEST_FILE = `${DEFAULT_CACHE_DIR}/manifest.json`
const DEFAULT_REMOTE_OFFLINE_OUTPUT_DIR = `${DEFAULT_CACHE_DIR}/runtime`
const DEFAULT_LOCAL_OUTPUT_DIR = "src/lib/bt"
const DEFAULT_PUBLIC_OUTPUT_SUBDIR = "bt"
const DEFAULT_PUBLIC_BASE_PATH = "/bt"
const DEFAULT_ROOT_DIR = "src"
const DEFAULT_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".svelte"]
const VIRTUAL_MESSAGES_MODULE_ID = "better-translation/messages"
const RESOLVED_VIRTUAL_MESSAGES_MODULE_ID = `\0${VIRTUAL_MESSAGES_MODULE_ID}`
const LOCALES_SUBDIR = "locales"
const DEFAULT_TRANSLATION_BATCH_SIZE = 25
const WATCHER_RECONCILIATION_DELAY_MS = 50
let temporaryFileSequence = 0
const BETTER_TRANSLATION_PLUGIN_API = "__betterTranslation" as const

/** Internal lifecycle API used by the package CLI after Vite resolves the plugin. */
export interface BetterTranslationPluginApi {
  generate(): Promise<void>
}

type BetterTranslationPluginWithApi = Plugin & {
  [BETTER_TRANSLATION_PLUGIN_API]?: BetterTranslationPluginApi
}

export function getBetterTranslationPluginApi(plugin: Plugin) {
  return (plugin as BetterTranslationPluginWithApi)[BETTER_TRANSLATION_PLUGIN_API]
}

function formatLocale(locale: string) {
  return locale.toUpperCase()
}

function formatLocales(locales: string[]) {
  return locales.map(formatLocale).join(", ")
}

/**
 * Creates the Better Translation Vite plugin.
 *
 * The plugin discovers Translation markers, maintains the private Manifest,
 * injects stable Lookup ids and runtime metadata, and generates flat Runtime
 * bundles. Local mode owns repo-local Locale values; remote mode synchronizes
 * the Manifest and generates a hosted Runtime bundle loader. Manifest metadata
 * and write credentials are never included in Runtime bundles.
 *
 * @param options - Locales, source roots, Runtime bundle ownership, and optional
 *   translation behavior.
 * @returns A Vite plugin for source transformation and build/dev lifecycle work.
 */
export function betterTranslation(options: BetterTranslatePluginOptions): Plugin {
  const {
    locales,
    defaultLocale = locales[0] ?? "en",
    rootDir = DEFAULT_ROOT_DIR,
    cacheFile = DEFAULT_TRANSLATION_CACHE_FILE,
    logging = true,
    runtime,
  } = options
  const configuredRuntime = normalizeRuntimeOptions(runtime)
  let manifestState = new ManifestState("", logging)
  let cache: TranslationCache = createEmptyCache()
  let resolvedRuntime = configuredRuntime
  let usesLocalStorage = shouldUseLocalStorage(configuredRuntime, false)
  let resolvedTranslate: TranslateFn | undefined = configuredRuntime.type === "local" ? configuredRuntime.translate : undefined
  let localesDir =
    configuredRuntime.type === "local" ? (configuredRuntime.output ?? DEFAULT_LOCAL_OUTPUT_DIR) : DEFAULT_LOCAL_OUTPUT_DIR
  let publicBasePath =
    configuredRuntime.type === "local" && configuredRuntime.target === "public"
      ? (configuredRuntime.basePath ?? DEFAULT_PUBLIC_BASE_PATH)
      : DEFAULT_PUBLIC_BASE_PATH
  let remoteUrl = configuredRuntime.type === "remote" ? (configuredRuntime.endpoint ?? REMOTE_API_BASE_URL) : REMOTE_API_BASE_URL
  let root = ""
  let isDev = false
  let translateTimer: ReturnType<typeof setTimeout> | null = null
  let artifactReconciliationTimer: ReturnType<typeof setTimeout> | null = null
  let pendingManifestWrite = false
  let pendingLocaleWrite = false
  let translationRun: Promise<void> | null = null
  let translationRunRequested = false
  let remoteSyncTimer: ReturnType<typeof setTimeout> | null = null
  let remoteSyncRun: Promise<void> | null = null
  let remoteSyncRunRequested = false
  let lastSyncedRemoteManifestSignature: string | null = null
  let sourceRoots: string[] = []
  let viteDevServer: ViteDevServer | undefined

  function log(message: string) {
    if (logging) console.log(message)
  }

  async function syncRemote() {
    if (resolvedRuntime.type !== "remote") return

    const payload = {
      defaultLocale,
      locales,
      messages: manifestState.snapshot(),
    }
    const signature = JSON.stringify(payload)
    if (lastSyncedRemoteManifestSignature === signature) return

    const apiKey = resolveRemoteSyncApiKey()
    const target = formatRemoteManifestTarget(resolvedRuntime, remoteUrl)
    if (!apiKey) {
      throw new Error(
        [
          `${PREFIX} remote Manifest sync requires a Project API key`,
          `set ${DEFAULT_REMOTE_API_KEY_ENV} or pass runtime.apiKey in the Vite plugin config`,
          `target: ${target}`,
        ].join("\n"),
      )
    }

    let response: Response
    try {
      response = await fetch(target, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      throw new Error(formatRemoteSyncNetworkError(target, error))
    }

    const body = await response.text()

    if (!response.ok) {
      throw new Error(formatRemoteSyncError(response, target, body))
    }

    const result = parseRemoteSyncResult(body)
    if (result?.changed) log(`${PREFIX} ${BOLD}Synced${RESET} Messages -> ${CYAN}${formatRuntime(resolvedRuntime)}${RESET}`)
    lastSyncedRemoteManifestSignature = signature
  }

  function resolveRemoteSyncApiKey() {
    const explicitApiKey = resolvedRuntime.type === "remote" ? resolvedRuntime.apiKey?.trim() : null
    if (explicitApiKey) return explicitApiKey

    const envApiKey = process.env[DEFAULT_REMOTE_API_KEY_ENV]?.trim()
    return envApiKey || null
  }

  function shouldScanFile(id: string) {
    const cleanId = normalizePath(id.split("?", 1)[0] ?? id)
    if (cleanId.split("/").includes("node_modules")) return false
    const extension = DEFAULT_SCAN_EXTENSIONS.find((ext) => cleanId.endsWith(ext))
    if (!extension) return false
    return sourceRoots.some((sourceRoot) => {
      const normalizedSourceRoot = normalizePath(sourceRoot)
      return cleanId === normalizedSourceRoot || cleanId.startsWith(`${normalizedSourceRoot}/`)
    })
  }

  function getPrivateManifestPath() {
    return resolve(root, DEFAULT_PRIVATE_MANIFEST_FILE)
  }

  function getLocalesDirPath() {
    return resolve(root, localesDir, LOCALES_SUBDIR)
  }

  function getLocalePath(locale: string) {
    return resolve(getLocalesDirPath(), `${locale}.json`)
  }

  function readLocaleMessages(locale: string): RuntimeMessages {
    const path = getLocalePath(locale)
    if (!existsSync(path)) return createRuntimeMessages()

    let input: unknown
    try {
      input = JSON.parse(readFileSync(path, "utf-8")) as unknown
    } catch (error) {
      throw new Error(`${PREFIX} could not parse Locale values at ${relative(root, path)}`, { cause: error })
    }

    const messages = normalizeLocaleMessages(input)
    if (!messages) throw new Error(`${PREFIX} invalid Locale values at ${relative(root, path)}`)
    return messages
  }

  function writePrivateManifest() {
    if (!usesLocalStorage) return
    const path = getPrivateManifestPath()
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileIfChanged(path, JSON.stringify(manifestState.snapshot(), null, 2) + "\n")
  }

  function buildLocalLocaleMessages(locale: string, manifestEntries: Array<[string, ManifestEntry]>): RuntimeMessages {
    const existingMessages = readLocaleMessages(locale)
    const messages = createRuntimeMessages()

    if (locale === defaultLocale) {
      for (const [id, entry] of manifestEntries) {
        messages[id] = entry.defaultMessage
      }
      return messages
    }

    for (const [id, entry] of manifestEntries) {
      if (Object.hasOwn(messages, id)) continue
      const existingMessage = existingMessages[id]
      const cachedMessage = getFreshCachedMessage(id, locale)
      const existingMessageIsValid =
        existingMessage !== undefined && hasSameMessageStructure(entry.defaultMessage, existingMessage)

      if (existingMessageIsValid && !isUntranslatedLocaleValue(existingMessage, entry)) {
        messages[id] = existingMessage
        continue
      }

      if (cachedMessage !== undefined) messages[id] = cachedMessage
      else if (existingMessage !== undefined) messages[id] = existingMessage
      else if (shouldWriteDefaultLocaleFallback()) messages[id] = entry.defaultMessage
    }
    return messages
  }

  function writeLocaleFilesToDisk() {
    if (!usesLocalStorage) return
    const dir = getLocalesDirPath()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const manifestEntries = Object.entries(manifestState.snapshot())
    const localeArtifacts = locales.map((locale) => ({
      contents: JSON.stringify(buildLocalLocaleMessages(locale, manifestEntries), null, 2) + "\n",
      path: resolve(dir, `${locale}.json`),
    }))
    for (const artifact of localeArtifacts) writeFileIfChanged(artifact.path, artifact.contents)
  }

  function getMissingMessagesByLocale() {
    const missingByLocale = new Map<string, TranslateMessage[]>()
    const manifestEntries = Object.entries(manifestState.snapshot())

    for (const locale of locales) {
      if (locale === defaultLocale) continue
      const existingMessages = readLocaleMessages(locale)
      for (const [id, entry] of manifestEntries) {
        const existingMessage = existingMessages[id]
        const hasExistingMessage =
          existingMessage !== undefined &&
          hasSameMessageStructure(entry.defaultMessage, existingMessage) &&
          !isUntranslatedLocaleValue(existingMessage, entry)
        if (!hasExistingMessage && getFreshCachedMessage(id, locale) === undefined) {
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

    return missingByLocale
  }

  function assertLocalBuildTranslationsComplete() {
    const expectedIds = new Set(Object.keys(manifestState.manifest))
    const issues: string[] = []

    for (const locale of locales) {
      const localePath = getLocalePath(locale)
      if (!existsSync(localePath)) {
        issues.push(`- ${locale}: missing file at ${relative(root, localePath)}`)
        continue
      }

      const localeMessages = readLocaleMessages(locale)
      const missingIds = [...expectedIds].filter((id) => !Object.hasOwn(localeMessages, id))
      const orphanIds = Object.keys(localeMessages).filter((id) => !expectedIds.has(id))

      if (locale === defaultLocale) {
        const staleIds = [...expectedIds].filter((id) => localeMessages[id] !== manifestState.manifest[id]!.defaultMessage)
        if (missingIds.length > 0) issues.push(formatLocaleIssue(locale, "missing", missingIds))
        if (orphanIds.length > 0) issues.push(formatLocaleIssue(locale, "orphaned", orphanIds))
        if (staleIds.length > 0) issues.push(formatLocaleIssue(locale, "outdated default messages", staleIds))
        continue
      }

      const invalidIds = [...expectedIds].filter((id) => {
        const value = localeMessages[id]
        return value !== undefined && !hasSameMessageStructure(manifestState.manifest[id]!.defaultMessage, value)
      })
      const untranslatedFallbackIds = [...expectedIds].filter((id) => {
        const value = localeMessages[id]
        return (
          value !== undefined &&
          isUntranslatedLocaleValue(value, manifestState.manifest[id]!) &&
          getFreshCachedMessage(id, locale) !== value
        )
      })
      if (missingIds.length > 0) issues.push(formatLocaleIssue(locale, "missing", missingIds))
      if (orphanIds.length > 0) issues.push(formatLocaleIssue(locale, "orphaned", orphanIds))
      if (invalidIds.length > 0) issues.push(formatLocaleIssue(locale, "invalid placeholders or rich-text elements", invalidIds))
      if (untranslatedFallbackIds.length > 0) {
        issues.push(formatLocaleIssue(locale, "untranslated fallback", untranslatedFallbackIds))
      }
    }

    if (issues.length === 0) return

    throw new Error(
      [
        `${PREFIX} committed locale artifacts are out of sync for local production build`,
        `local production builds are check-only and never regenerate Runtime bundles`,
        `run \`bt generate\` or the dev workflow to regenerate locale artifacts and commit the result`,
        ...issues,
      ].join("\n"),
    )
  }

  async function translateMissingMessages() {
    if (!resolvedTranslate) return false
    const missingByLocale = getMissingMessagesByLocale()

    const totalMisses = [...missingByLocale.values()].reduce((count, misses) => count + misses.length, 0)
    if (totalMisses === 0) return false

    const missLocales = [...missingByLocale.keys()]
    log(
      `${PREFIX} ${BOLD}Translating${RESET} ${CYAN}${totalMisses}${RESET} ${totalMisses === 1 ? "Message" : "Messages"} -> ${CYAN}${formatLocales(missLocales)}${RESET}`,
    )

    let translatedCount = 0
    pruneTranslationCache()
    for (const [locale, misses] of missingByLocale) {
      const localeMessages = readLocaleMessages(locale)
      for (const batch of chunk(misses, getTranslationBatchSize(resolvedRuntime))) {
        const result = await resolvedTranslate(batch, locale)
        const translatedMessages = createRuntimeMessages()

        for (const miss of batch) {
          const translated = getOwnValue(result, miss.id)?.trim()
          if (!translated) continue
          if (!hasSameMessageStructure(miss.text, translated)) {
            throw new Error(`${PREFIX} translation for "${miss.id}" did not preserve its placeholders and rich-text elements`)
          }
          cache.entries[getCacheKey(miss.id, locale)] = {
            sourceText: miss.text,
            meta: miss.meta,
            locale,
            translation: translated,
            timestamp: Date.now(),
          }
          localeMessages[miss.id] = translated
          translatedMessages[miss.id] = translated
          translatedCount += 1
        }

        saveCache(resolve(root, cacheFile), cache)
        writeFileIfChanged(getLocalePath(locale), JSON.stringify(localeMessages, null, 2) + "\n")
        if (Object.keys(translatedMessages).length > 0) {
          viteDevServer?.ws.send({
            type: "custom",
            event: LOCALE_VALUES_HOT_UPDATE_EVENT,
            data: { locale, messages: translatedMessages },
          })
        }
      }
    }

    log(
      `${PREFIX} ${BOLD}Translated${RESET} ${CYAN}${translatedCount}${RESET}/${CYAN}${totalMisses}${RESET} ${totalMisses === 1 ? "Message" : "Messages"} -> ${CYAN}${formatLocales(missLocales)}${RESET}`,
    )

    return true
  }

  function getFreshCachedMessage(id: string, locale: string) {
    const entry = manifestState.manifest[id]
    const cachedMessage = cache.entries[getCacheKey(id, locale)]
    if (!entry || !cachedMessage) return undefined
    if (cachedMessage.sourceText !== entry.defaultMessage) return undefined
    if (serializeMeta(cachedMessage.meta) !== serializeMeta(entry.meta)) return undefined
    if (!hasSameMessageStructure(entry.defaultMessage, cachedMessage.translation)) return undefined
    return cachedMessage.translation
  }

  function pruneTranslationCache() {
    for (const [key, cachedMessage] of Object.entries(cache.entries)) {
      const separatorIndex = key.lastIndexOf("\0")
      const id = separatorIndex === -1 ? "" : key.slice(0, separatorIndex)
      const locale = separatorIndex === -1 ? "" : key.slice(separatorIndex + 1)
      if (
        locale !== cachedMessage.locale ||
        !locales.includes(locale) ||
        !manifestState.manifest[id] ||
        getFreshCachedMessage(id, locale) === undefined
      ) {
        delete cache.entries[key]
      }
    }
  }

  function isUntranslatedLocaleValue(value: string, entry: Pick<ManifestEntry, "defaultMessage">) {
    return resolvedTranslate !== undefined && value.trim() === entry.defaultMessage.trim()
  }

  function shouldWriteDefaultLocaleFallback() {
    return resolvedTranslate !== undefined || isRemoteOfflineDev(resolvedRuntime, isDev)
  }

  function scheduleDevTranslation() {
    if (!resolvedTranslate) return
    if (!isDev) return
    if (translateTimer) clearTimeout(translateTimer)
    translateTimer = setTimeout(() => {
      translateTimer = null
      requestDevTranslationRun()
    }, 1000)
  }

  function requestDevTranslationRun() {
    translationRunRequested = true
    if (translationRun) return

    translationRun = (async () => {
      while (translationRunRequested) {
        translationRunRequested = false
        try {
          await translateMissingMessages()
        } catch (error) {
          console.error(error instanceof Error ? error.message : error)
        }
      }
    })().finally(() => {
      translationRun = null
      if (translationRunRequested) requestDevTranslationRun()
    })
  }

  function scheduleDevRemoteSync() {
    if (usesLocalStorage || !isDev) return
    if (remoteSyncTimer) clearTimeout(remoteSyncTimer)
    remoteSyncTimer = setTimeout(() => {
      remoteSyncTimer = null
      requestDevRemoteSyncRun()
    }, 1000)
  }

  function requestDevRemoteSyncRun() {
    remoteSyncRunRequested = true
    if (remoteSyncRun) return

    remoteSyncRun = (async () => {
      while (remoteSyncRunRequested) {
        remoteSyncRunRequested = false
        try {
          await syncRemote()
        } catch (error) {
          console.error(error instanceof Error ? error.message : error)
        }
      }
    })().finally(() => {
      remoteSyncRun = null
      if (remoteSyncRunRequested) requestDevRemoteSyncRun()
    })
  }

  function writeLocaleMessages(locale: string, localeMessages: RuntimeMessages) {
    const dir = getLocalesDirPath()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const messages = createRuntimeMessages()
    for (const [id, entry] of Object.entries(manifestState.snapshot())) {
      if (locale === defaultLocale) {
        messages[id] = entry.defaultMessage
        continue
      }

      const existingMessage = localeMessages[id]
      const cachedMessage = getFreshCachedMessage(id, locale)
      if (existingMessage !== undefined) messages[id] = existingMessage
      else if (cachedMessage !== undefined) messages[id] = cachedMessage
      else if (shouldWriteDefaultLocaleFallback()) messages[id] = entry.defaultMessage
    }

    writeFileIfChanged(getLocalePath(locale), JSON.stringify(messages, null, 2) + "\n")
  }

  function flushArtifactReconciliation() {
    const shouldWriteLocales = pendingLocaleWrite
    const shouldWriteManifest = pendingManifestWrite
    pendingLocaleWrite = false
    pendingManifestWrite = false

    if (shouldWriteLocales) {
      writeLocaleFilesToDisk()
      writePrivateManifest()
      return
    }
    if (shouldWriteManifest) writePrivateManifest()
  }

  function applySyncResult(syncResult: ManifestSyncResult | null, options: { scheduleTranslation: boolean }) {
    if (!syncResult) return
    pendingManifestWrite ||= syncResult.manifestChanged
    pendingLocaleWrite ||= syncResult.localeMessagesChanged
    if (!pendingManifestWrite && !pendingLocaleWrite) return
    if (syncResult.localeMessagesChanged && options.scheduleTranslation) scheduleDevTranslation()

    if (artifactReconciliationTimer) clearTimeout(artifactReconciliationTimer)
    artifactReconciliationTimer = setTimeout(() => {
      artifactReconciliationTimer = null
      try {
        flushArtifactReconciliation()
      } catch (error) {
        console.error(error instanceof Error ? error.message : error)
      }
    }, WATCHER_RECONCILIATION_DELAY_MS)
  }

  function stopPendingArtifactReconciliation() {
    if (!artifactReconciliationTimer) return
    clearTimeout(artifactReconciliationTimer)
    artifactReconciliationTimer = null
    flushArtifactReconciliation()
  }

  function resetPendingArtifactReconciliation() {
    if (artifactReconciliationTimer) {
      clearTimeout(artifactReconciliationTimer)
      artifactReconciliationTimer = null
    }
    pendingManifestWrite = false
    pendingLocaleWrite = false
  }

  function scanAllSourceFiles() {
    manifestState.reset()

    const scannedFiles = new Set<string>()
    for (const sourceRoot of sourceRoots) {
      if (!existsSync(sourceRoot)) continue
      for (const file of collectScanFiles(sourceRoot).sort()) {
        const normalizedFile = normalizePath(file)
        if (scannedFiles.has(normalizedFile)) continue
        scannedFiles.add(normalizedFile)
        const code = readFileSync(file, "utf-8")
        manifestState.sync(file, code)
      }
    }
  }

  function toRootRelativePath(file: string) {
    return relative(root, file).replaceAll("\\", "/")
  }

  function createVirtualMessagesModule() {
    let moduleCode: string
    if (isRemoteOfflineDev(resolvedRuntime, isDev)) {
      moduleCode = createModuleMessagesModule(locales, (locale) => `/${normalizePath(toRootRelativePath(getLocalePath(locale)))}`)
    } else if (resolvedRuntime.type === "remote") {
      moduleCode = createRemoteMessagesModule(resolvedRuntime, locales, remoteUrl)
    } else if (resolvedRuntime.target === "public") {
      moduleCode = createPublicMessagesModule(locales, publicBasePath)
    } else {
      moduleCode = createModuleMessagesModule(locales, (locale) => `/${normalizePath(toRootRelativePath(getLocalePath(locale)))}`)
    }
    return isDev ? `${moduleCode}\n${createLocaleValuesHotUpdateBridge()}` : moduleCode
  }

  async function stopPendingLifecycleWork() {
    stopPendingArtifactReconciliation()
    if (translateTimer) {
      clearTimeout(translateTimer)
      translateTimer = null
    }
    if (remoteSyncTimer) {
      clearTimeout(remoteSyncTimer)
      remoteSyncTimer = null
    }
    translationRunRequested = false
    remoteSyncRunRequested = false
    await Promise.all([translationRun, remoteSyncRun])
  }

  async function generateLocalArtifacts() {
    if (!root) throw new Error(`${PREFIX} Vite config must be resolved before generating locale artifacts`)
    if (resolvedRuntime.type !== "local") {
      throw new Error(
        [
          `${PREFIX} \`bt generate\` currently supports local runtime mode only`,
          `remote runtime mode syncs its Manifest through the Vite plugin during dev and build`,
        ].join("\n"),
      )
    }

    cache = loadCache(resolve(root, cacheFile))
    scanAllSourceFiles()
    writeLocaleFilesToDisk()
    writePrivateManifest()

    await translateMissingMessages()

    writeLocaleFilesToDisk()
    writePrivateManifest()
    saveCache(resolve(root, cacheFile), cache)
    assertLocalBuildTranslationsComplete()
    log(`${PREFIX} ${BOLD}Generated${RESET} Runtime bundles -> ${CYAN}${formatRuntime(resolvedRuntime)}${RESET}`)
  }

  const plugin: BetterTranslationPluginWithApi = {
    name: "better-translation-extract",
    enforce: "pre",

    config() {
      return {
        ssr: {
          noExternal: ["better-translation"],
        },
      }
    },

    configResolved(config) {
      resetPendingArtifactReconciliation()
      validateLocaleConfiguration(locales, defaultLocale)
      root = config.root
      manifestState = new ManifestState(root, logging)
      isDev = config.command === "serve"
      resolvedRuntime = resolveRuntimeOptions(configuredRuntime, config)
      usesLocalStorage = shouldUseLocalStorage(resolvedRuntime, isDev)
      resolvedTranslate = resolvedRuntime.type === "local" ? resolvedRuntime.translate : undefined
      localesDir = getRuntimeOutputDir(resolvedRuntime, isDev)
      publicBasePath =
        resolvedRuntime.type === "local" && resolvedRuntime.target === "public"
          ? (resolvedRuntime.basePath ?? DEFAULT_PUBLIC_BASE_PATH)
          : DEFAULT_PUBLIC_BASE_PATH
      remoteUrl = resolvedRuntime.type === "remote" ? (resolvedRuntime.endpoint ?? REMOTE_API_BASE_URL) : REMOTE_API_BASE_URL
      sourceRoots = (Array.isArray(rootDir) ? rootDir : [rootDir]).map((dir) => resolve(root, dir))
      log(
        `${PREFIX} Locales: ${CYAN}${formatLocales(locales)}${RESET} | Default: ${CYAN}${formatLocale(defaultLocale)}${RESET} | Runtime: ${CYAN}${formatRuntime(resolvedRuntime)}${RESET} | Out Dir: ${DIM}${usesLocalStorage ? localesDir : "n/a"}${RESET} | Roots: ${DIM}${(Array.isArray(rootDir) ? rootDir : [rootDir]).join(", ")}${RESET}`,
      )
    },

    resolveId(id) {
      if (id === VIRTUAL_MESSAGES_MODULE_ID) return RESOLVED_VIRTUAL_MESSAGES_MODULE_ID
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MESSAGES_MODULE_ID) return createVirtualMessagesModule()
    },

    async buildStart() {
      cache = loadCache(resolve(root, cacheFile))
      scanAllSourceFiles()
      if (usesLocalStorage && !isDev) {
        assertLocalBuildTranslationsComplete()
        return
      }
      writeLocaleFilesToDisk()
      writePrivateManifest()

      if (isDev) scheduleDevTranslation()
    },

    configureServer(server) {
      viteDevServer = server
      const localEditorOptions = getLocalEditorOptions({ isDev, runtime: resolvedRuntime })
      if (localEditorOptions) {
        configureLocalEditor(
          server,
          {
            defaultLocale,
            isUntranslatedLocaleValue,
            locales,
            log,
            manifest: manifestState.manifest,
            readLocaleMessages,
            writeLocaleMessages,
          },
          localEditorOptions,
        )
      }
      server.watcher.add(sourceRoots)
      server.httpServer?.once("listening", () => scheduleDevRemoteSync())

      const syncFileFromDisk = (file: string) => {
        if (!shouldScanFile(file) || !existsSync(file)) return
        applySyncResult(manifestState.sync(file, readFileSync(file, "utf-8")), { scheduleTranslation: true })
        scheduleDevRemoteSync()
      }

      const removeFileFromManifest = (file: string) => {
        if (!shouldScanFile(file)) return
        applySyncResult(manifestState.remove(file), { scheduleTranslation: true })
        scheduleDevRemoteSync()
      }

      server.watcher.on("add", syncFileFromDisk)
      server.watcher.on("change", syncFileFromDisk)
      server.watcher.on("unlink", removeFileFromManifest)
    },

    transform(code, id) {
      const cleanId = id.split("?", 1)[0] ?? id
      if (!shouldScanFile(cleanId)) return

      const analysis = manifestState.analyze(cleanId, code)

      if (analysis.edits.length === 0) return
      return {
        code: applyEdits(code, analysis.edits),
        map: null,
      }
    },

    async generateBundle() {
      if (!usesLocalStorage && isDev) {
        await translateMissingMessages()
      }

      if (!usesLocalStorage) {
        await syncRemote()
      }
    },

    async closeBundle() {
      await stopPendingLifecycleWork()
      if (!usesLocalStorage || !isDev) return
      pruneTranslationCache()
      saveCache(resolve(root, cacheFile), cache)
    },

    closeWatcher: stopPendingLifecycleWork,
  }

  plugin[BETTER_TRANSLATION_PLUGIN_API] = {
    generate: generateLocalArtifacts,
  }

  return plugin
}

function formatLocaleIssue(locale: string, label: string, ids: string[]) {
  const preview = ids
    .slice(0, 5)
    .map((id) => JSON.stringify(id))
    .join(", ")
  const suffix = ids.length > 5 ? `, ... ${ids.length - 5} more` : ""
  return `- ${locale}: ${label} (${preview}${suffix})`
}

function validateLocaleConfiguration(locales: string[], defaultLocale: string) {
  if (locales.length === 0) throw new Error(`${PREFIX} configure at least one Locale`)
  if (locales.some((locale) => locale.trim().length === 0)) throw new Error(`${PREFIX} Locale names cannot be empty`)
  if (new Set(locales).size !== locales.length) throw new Error(`${PREFIX} duplicate Locale values are not allowed`)
  if (!locales.includes(defaultLocale)) {
    throw new Error(`${PREFIX} Default locale ${JSON.stringify(defaultLocale)} must be included in locales`)
  }
}

function shouldUseLocalStorage(runtime: BetterTranslateRuntimeOptions, isDev: boolean) {
  return runtime.type === "local" || isRemoteOfflineDev(runtime, isDev)
}

function isRemoteOfflineDev(runtime: BetterTranslateRuntimeOptions, isDev: boolean) {
  return runtime.type === "remote" && isDev && runtime.dev?.offline === true
}

function getRuntimeOutputDir(runtime: BetterTranslateRuntimeOptions, isDev: boolean) {
  if (runtime.type === "local") return runtime.output!
  if (isRemoteOfflineDev(runtime, isDev)) return DEFAULT_REMOTE_OFFLINE_OUTPUT_DIR
  return DEFAULT_LOCAL_OUTPUT_DIR
}

function normalizeRuntimeOptions(runtime: BetterTranslateRuntimeOptions | undefined): BetterTranslateRuntimeOptions {
  if (runtime) {
    if (runtime.type !== "local" || !runtime.translate) {
      return runtime.type === "local" ? { ...runtime, target: runtime.target ?? "module" } : runtime
    }
    return {
      ...runtime,
      target: runtime.target ?? "module",
      translationBatchSize: normalizeTranslationBatchSize(runtime.translationBatchSize),
    }
  }
  return { type: "local", target: "module" }
}

function resolveRuntimeOptions(runtime: BetterTranslateRuntimeOptions, config: ResolvedConfig): BetterTranslateRuntimeOptions {
  if (runtime.type === "remote") {
    const projectId = typeof runtime.projectId === "string" ? runtime.projectId.trim() : ""
    if (!projectId) {
      throw new Error(`${PREFIX} remote runtime requires a projectId`)
    }
    return {
      ...runtime,
      projectId,
      endpoint: runtime.endpoint ?? REMOTE_API_BASE_URL,
      branch: resolveBranch(runtime, config.root),
      dev: {
        offline: runtime.dev?.offline ?? false,
      },
    }
  }

  const target = runtime.target ?? "module"
  if (target === "module") {
    return {
      ...runtime,
      target,
      output: runtime.output ?? DEFAULT_LOCAL_OUTPUT_DIR,
    }
  }

  if (!config.publicDir) {
    throw new Error(`${PREFIX} runtime target "public" requires Vite publicDir to be enabled`)
  }

  const output = runtime.output ?? normalizePath(relative(config.root, resolve(config.publicDir, DEFAULT_PUBLIC_OUTPUT_SUBDIR)))
  const outputPath = resolve(config.root, output)
  const publicBasePath = runtime.basePath ?? inferPublicBasePath(outputPath, config.publicDir)

  return {
    ...runtime,
    target,
    output,
    basePath: publicBasePath,
  }
}

function inferPublicBasePath(outputPath: string, publicDir: string) {
  const relativeToPublic = normalizePath(relative(publicDir, outputPath))
  if (relativeToPublic.startsWith("..")) {
    throw new Error(`${PREFIX} runtime target "public" output must be inside Vite publicDir unless basePath is provided`)
  }
  return `/${relativeToPublic}`.replace(/\/$/, "")
}

function formatRuntime(runtime: BetterTranslateRuntimeOptions) {
  return runtime.type === "local" ? `Local/${runtime.target ?? "module"}` : `Remote/${runtime.branch ?? "auto"}`
}

function resolveBranch(runtime: Pick<Extract<BetterTranslateRuntimeOptions, { type: "remote" }>, "branch">, root: string) {
  if (runtime.branch && runtime.branch !== "auto") return runtime.branch

  const envBranch = process.env.BETTER_TRANSLATION_BRANCH?.trim()
  if (envBranch) return envBranch

  const providerBranch = process.env.VERCEL_GIT_COMMIT_REF?.trim()
  if (providerBranch) return providerBranch

  const gitBranch = readCurrentGitBranch(root)
  return gitBranch ?? DEFAULT_REMOTE_BRANCH
}

function readCurrentGitBranch(root: string) {
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return branch || null
  } catch {
    return null
  }
}

function formatRemoteManifestTarget(runtime: Extract<BetterTranslateRuntimeOptions, { type: "remote" }>, endpoint: string) {
  return `${endpoint.replace(/\/$/, "")}/api/projects/${encodeURIComponent(runtime.projectId)}/branches/${encodeURIComponent(runtime.branch ?? DEFAULT_REMOTE_BRANCH)}/manifest`
}

function parseRemoteSyncResult(body: string) {
  try {
    const parsed = JSON.parse(body) as unknown
    if (typeof parsed !== "object" || parsed === null) return null
    return {
      changed: "changed" in parsed && parsed.changed === true,
    }
  } catch {
    return null
  }
}

function formatRemoteSyncError(response: Response, target: string, body: string) {
  const details = formatRemoteSyncResponseDetails(body)
  return [
    `${PREFIX} remote Manifest sync failed with ${response.status} ${response.statusText || "HTTP error"}`,
    `target: ${target}`,
    details ? `response: ${details}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

function formatRemoteSyncNetworkError(target: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return [`${PREFIX} remote Manifest sync could not reach the hosted service`, `target: ${target}`, `error: ${message}`].join(
    "\n",
  )
}

function formatRemoteSyncResponseDetails(body: string) {
  const details = body.trim().replace(/\s+/g, " ")
  if (!details) return ""
  return details.length > 500 ? `${details.slice(0, 500)}...` : details
}

function createModuleMessagesModule(locales: string[], getImportPath: (locale: string) => string) {
  const cases = locales
    .map(
      (locale) => `    case ${JSON.stringify(locale)}:
      return (await import(${JSON.stringify(getImportPath(locale))})).default`,
    )
    .join("\n")

  return [
    `export const locales = ${JSON.stringify(locales)}`,
    "",
    "export async function loadMessages(locale) {",
    "  switch (locale) {",
    cases,
    "    default:",
    "      throw new Error(`Unknown locale: ${locale}`)",
    "  }",
    "}",
    "",
  ].join("\n")
}

function createLocaleValuesHotUpdateBridge() {
  return [
    `if (import.meta.hot && typeof window !== "undefined") {`,
    `  import.meta.hot.on(${JSON.stringify(LOCALE_VALUES_HOT_UPDATE_EVENT)}, (update) => {`,
    `    window.dispatchEvent(new CustomEvent(${JSON.stringify(LOCALE_VALUES_HOT_UPDATE_EVENT)}, { detail: update }))`,
    "  })",
    "}",
    "",
  ].join("\n")
}

function createPublicMessagesModule(locales: string[], basePath: string) {
  const normalizedBasePath = basePath.replace(/\/$/, "")
  return [
    `export const locales = ${JSON.stringify(locales)}`,
    "",
    "export async function loadMessages(locale) {",
    "  assertKnownLocale(locale)",
    `  const response = await fetch(\`${normalizedBasePath}/locales/\${encodeURIComponent(locale)}.json\`)`,
    "  if (!response.ok) throw new Error(`Failed to load locale: ${locale}`)",
    "  return response.json()",
    "}",
    "",
    createKnownLocaleAssertion(locales),
  ].join("\n")
}

function createRemoteMessagesModule(
  runtime: Extract<BetterTranslateRuntimeOptions, { type: "remote" }>,
  locales: string[],
  endpoint: string,
) {
  const normalizedEndpoint = endpoint.replace(/\/$/, "")
  const projectPath = `/projects/${encodeURIComponent(runtime.projectId)}`
  const branchPath = `/branches/${encodeURIComponent(runtime.branch ?? DEFAULT_REMOTE_BRANCH)}`
  return [
    `export const locales = ${JSON.stringify(locales)}`,
    "",
    "export async function loadMessages(locale) {",
    "  assertKnownLocale(locale)",
    `  const response = await fetch(\`${normalizedEndpoint}${projectPath}${branchPath}/locales/\${encodeURIComponent(locale)}.json\`)`,
    "  if (!response.ok) throw new Error(`Failed to load locale: ${locale}`)",
    "  return response.json()",
    "}",
    "",
    createKnownLocaleAssertion(locales),
  ].join("\n")
}

function createKnownLocaleAssertion(locales: string[]) {
  return [
    `const knownLocales = new Set(${JSON.stringify(locales)})`,
    "",
    "function assertKnownLocale(locale) {",
    "  if (!knownLocales.has(locale)) throw new Error(`Unknown locale: ${locale}`)",
    "}",
    "",
  ].join("\n")
}

function normalizeLocaleMessages(input: unknown): RuntimeMessages | null {
  if (isRuntimeMessages(input)) return createRuntimeMessages(Object.entries(input))
  if (
    typeof input === "object" &&
    input !== null &&
    "messages" in input &&
    typeof input.messages === "object" &&
    input.messages !== null &&
    !Array.isArray(input.messages)
  ) {
    const entries = Object.entries(input.messages)
    if (!entries.every(([, entry]) => isLegacyLocaleMessageEntry(entry))) return null
    return createRuntimeMessages(entries.map(([id, entry]) => [id, entry.translation]))
  }
  return null
}

function createRuntimeMessages(entries: Iterable<readonly [string, string]> = []) {
  const messages = Object.create(null) as RuntimeMessages
  for (const [id, value] of entries) messages[id] = value
  return messages
}

function isLegacyLocaleMessageEntry(input: unknown): input is { translation: string } {
  return typeof input === "object" && input !== null && "translation" in input && typeof input.translation === "string"
}

function writeFileIfChanged(path: string, contents: string) {
  if (existsSync(path) && readFileSync(path, "utf-8") === contents) return false
  const temporaryPath = `${path}.${process.pid}.${temporaryFileSequence++}.tmp`
  try {
    writeFileSync(temporaryPath, contents)
    renameSync(temporaryPath, path)
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath)
  }
  return true
}

function collectScanFiles(root: string) {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue
      files.push(...collectScanFiles(path))
      continue
    }
    if (DEFAULT_SCAN_EXTENSIONS.some((extension) => path.endsWith(extension))) files.push(path)
  }
  return files
}

function isRuntimeMessages(input: unknown): input is RuntimeMessages {
  return (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    Object.values(input).every((value) => typeof value === "string")
  )
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function normalizeTranslationBatchSize(size: number | undefined) {
  if (typeof size !== "number" || !Number.isFinite(size)) return DEFAULT_TRANSLATION_BATCH_SIZE
  return Math.max(1, Math.floor(size))
}

function getTranslationBatchSize(runtime: BetterTranslateRuntimeOptions) {
  if (runtime.type !== "local" || !runtime.translate) return DEFAULT_TRANSLATION_BATCH_SIZE
  return normalizeTranslationBatchSize(runtime.translationBatchSize)
}

function applyEdits(code: string, edits: Array<{ start: number; end: number; replacement: string }>) {
  const reversedChunks: string[] = []
  let cursor = code.length
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    if (edit.end > cursor) throw new Error(`${PREFIX} source analysis produced overlapping source edits`)
    reversedChunks.push(code.slice(edit.end, cursor), edit.replacement)
    cursor = edit.start
  }
  reversedChunks.push(code.slice(0, cursor))
  return reversedChunks.reverse().join("")
}
