import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { normalizePath, type Plugin, type ResolvedConfig } from "vite"

import type {
  BetterTranslatePluginOptions,
  BetterTranslateRuntimeOptions,
  ExtractedMessage,
  ManifestEntry,
  MessageManifest,
  MessageManifestFile,
  MessageSource,
  RuntimeMessages,
  TranslateFn,
  TranslateMessage,
  TranslationCache,
} from "./types.js"

import { createEmptyCache, getCacheKey, loadCache, saveCache } from "./cache.js"
import { analyzeSourceFile } from "./extractor.js"
import { configureLocalEditor, getLocalEditorOptions } from "./local-editor/server.js"
import { serializeMeta } from "./message-id.js"

const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const CYAN = "\x1b[36m"
const REMOTE_API_BASE_URL = "https://better-translation.dev"
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
const DEFAULT_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"]
const VIRTUAL_MESSAGES_MODULE_ID = "better-translation/messages"
const RESOLVED_VIRTUAL_MESSAGES_MODULE_ID = `\0${VIRTUAL_MESSAGES_MODULE_ID}`
const CALL_MARKERS = ["t", "useT"]
const COMPONENT_MARKERS = ["T"]
const LOCALES_SUBDIR = "locales"

interface SyncResult {
  manifestChanged: boolean
  localeMessagesChanged: boolean
}

function formatLocale(locale: string) {
  return locale.toUpperCase()
}

function formatLocales(locales: string[]) {
  return locales.map(formatLocale).join(", ")
}

/** Scans source files for translatable messages and keeps locale JSON files in sync. */
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
  const manifest: MessageManifest = {}
  const fileMessages = new Map<string, ExtractedMessage[]>()
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
  let remoteSyncTimer: ReturnType<typeof setTimeout> | null = null
  let lastSyncedRemoteManifestSignature: string | null = null
  let sourceRoots: string[] = []

  function log(message: string) {
    if (logging) console.log(message)
  }

  async function syncRemote() {
    if (resolvedRuntime.type !== "remote") return

    const payload = {
      defaultLocale,
      locales,
      messages: buildMessageManifest(),
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

  function buildMessageManifest(): MessageManifestFile {
    return Object.fromEntries(
      Object.entries(manifest)
        .sort(compareManifestEntryIds)
        .map(([id, entry]) => [
          id,
          {
            defaultMessage: entry.defaultMessage,
            meta: entry.meta,
            placeholders: entry.placeholders,
            sources: entry.sources.length > 1 ? [...entry.sources].sort(compareMessageSources) : entry.sources,
          },
        ]),
    )
  }

  function shouldScanFile(id: string) {
    const cleanId = id.split("?", 1)[0] ?? id
    if (cleanId.includes("node_modules")) return false
    const extension = DEFAULT_SCAN_EXTENSIONS.find((ext) => cleanId.endsWith(ext))
    if (!extension) return false
    return sourceRoots.some(
      (sourceRoot) => cleanId === sourceRoot || cleanId.startsWith(`${sourceRoot}/`) || cleanId.startsWith(`${sourceRoot}\\`),
    )
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
    if (!existsSync(path)) return {}

    try {
      const input = JSON.parse(readFileSync(path, "utf-8")) as unknown
      return normalizeLocaleMessages(input)
    } catch {
      return {}
    }
  }

  function writePrivateManifest() {
    if (!usesLocalStorage) return
    const path = getPrivateManifestPath()
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileIfChanged(path, JSON.stringify(buildMessageManifest(), null, 2) + "\n")
  }

  function buildLocalLocaleMessages(locale: string, manifestEntries: Array<[string, ManifestEntry]>): RuntimeMessages {
    const existingMessages = readLocaleMessages(locale)
    const messages: RuntimeMessages = {}

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

      if (existingMessage !== undefined && !isUntranslatedLocaleValue(existingMessage, entry)) {
        messages[id] = existingMessage
        continue
      }

      if (cachedMessage !== undefined) messages[id] = cachedMessage
      else if (shouldWriteDefaultLocaleFallback()) messages[id] = entry.defaultMessage
    }
    return messages
  }

  function writeLocaleFilesToDisk() {
    if (!usesLocalStorage) return
    const dir = getLocalesDirPath()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const manifestEntries = Object.entries(manifest).sort(compareManifestEntryIds)
    for (const locale of locales) {
      writeFileIfChanged(
        resolve(dir, `${locale}.json`),
        JSON.stringify(buildLocalLocaleMessages(locale, manifestEntries), null, 2) + "\n",
      )
    }
  }

  function getMissingMessagesByLocale() {
    const missingByLocale = new Map<string, TranslateMessage[]>()
    const manifestEntries = Object.entries(manifest).sort(compareManifestEntryIds)

    for (const locale of locales) {
      if (locale === defaultLocale) continue
      const existingMessages = readLocaleMessages(locale)
      for (const [id, entry] of manifestEntries) {
        const existingMessage = existingMessages[id]
        const hasExistingMessage = existingMessage !== undefined && !isUntranslatedLocaleValue(existingMessage, entry)
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
    const expectedIds = new Set(Object.keys(manifest))
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
        const staleIds = [...expectedIds].filter((id) => localeMessages[id] !== manifest[id]!.defaultMessage)
        if (missingIds.length > 0) issues.push(formatLocaleIssue(locale, "missing", missingIds))
        if (orphanIds.length > 0) issues.push(formatLocaleIssue(locale, "orphaned", orphanIds))
        if (staleIds.length > 0) issues.push(formatLocaleIssue(locale, "outdated default messages", staleIds))
        continue
      }

      if (missingIds.length > 0) issues.push(formatLocaleIssue(locale, "missing", missingIds))
      if (orphanIds.length > 0) issues.push(formatLocaleIssue(locale, "orphaned", orphanIds))
    }

    if (issues.length === 0) return

    throw new Error(
      [
        `${PREFIX} committed locale artifacts are out of sync for local production build`,
        `local production builds are check-only and never regenerate locale files`,
        `run the dev workflow to regenerate locale artifacts and commit the result`,
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
    for (const [locale, misses] of missingByLocale) {
      const result = await resolvedTranslate(misses, locale)

      for (const miss of misses) {
        const translated = result[miss.id]?.trim()
        if (!translated) continue
        cache.entries[getCacheKey(miss.id, locale)] = {
          sourceText: miss.text,
          meta: miss.meta,
          locale,
          translation: translated,
          timestamp: Date.now(),
        }
        translatedCount += 1
      }
    }

    log(
      `${PREFIX} ${BOLD}Translated${RESET} ${CYAN}${translatedCount}${RESET}/${CYAN}${totalMisses}${RESET} ${totalMisses === 1 ? "Message" : "Messages"} -> ${CYAN}${formatLocales(missLocales)}${RESET}`,
    )

    return true
  }

  function getFreshCachedMessage(id: string, locale: string) {
    const entry = manifest[id]
    const cachedMessage = cache.entries[getCacheKey(id, locale)]
    if (!entry || !cachedMessage) return undefined
    if (cachedMessage.sourceText !== entry.defaultMessage) return undefined
    if (serializeMeta(cachedMessage.meta) !== serializeMeta(entry.meta)) return undefined
    return cachedMessage.translation
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
    translateTimer = setTimeout(async () => {
      const translated = await translateMissingMessages()
      if (translated) saveCache(resolve(root, cacheFile), cache)
      writeLocaleFilesToDisk()
      writePrivateManifest()
    }, 1000)
  }

  function scheduleDevRemoteSync() {
    if (usesLocalStorage || !isDev) return
    if (remoteSyncTimer) clearTimeout(remoteSyncTimer)
    remoteSyncTimer = setTimeout(() => {
      void syncRemote().catch((error) => console.error(error instanceof Error ? error.message : error))
    }, 1000)
  }

  function writeLocaleMessages(locale: string, localeMessages: RuntimeMessages) {
    const dir = getLocalesDirPath()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const messages: RuntimeMessages = {}
    for (const [id, entry] of Object.entries(manifest).sort(compareManifestEntryIds)) {
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

  function syncFileMessages(file: string, messages: ExtractedMessage[]): SyncResult {
    const previousMessages = fileMessages.get(file) ?? []
    const nextEntries = groupMessagesById(messages)
    for (const [id, entry] of Object.entries(nextEntries)) {
      const existing = manifest[id]
      if (existing && !hasSameMessageShape(existing, entry)) {
        throw new Error(formatCollisionError(id, existing, entry))
      }
    }

    removeFileMessages(file)
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
    return {
      manifestChanged:
        previousMessages.length !== messages.length ||
        previousMessages.some((message, index) => !isSameExtractedMessage(message, messages[index])),
      localeMessagesChanged:
        previousMessages.length !== messages.length ||
        previousMessages.some((message, index) => !hasSameMessageShape(message, messages[index]!)),
    }
  }

  function syncSourceCode(file: string, code: string) {
    const analysis = analyzeSourceFile(code, file, {
      call: CALL_MARKERS,
      component: COMPONENT_MARKERS,
      logging,
    })
    if (!analysis.parsed) return null
    return syncFileMessages(
      file,
      analysis.messages.map((message) => ({
        ...message,
        source: {
          ...message.source,
          file: toRootRelativePath(message.source.file),
        },
      })),
    )
  }

  function removeTrackedFile(file: string): SyncResult {
    const hadPreviousMessages = removeFileMessages(file)
    return {
      manifestChanged: hadPreviousMessages,
      localeMessagesChanged: hadPreviousMessages,
    }
  }

  function applySyncResult(syncResult: SyncResult | null, options: { scheduleTranslation: boolean }) {
    if (!syncResult) return
    if (syncResult.localeMessagesChanged) {
      writeLocaleFilesToDisk()
      writePrivateManifest()
      if (options.scheduleTranslation) scheduleDevTranslation()
      return
    }
    if (syncResult.manifestChanged) writePrivateManifest()
  }

  function scanAllSourceFiles() {
    for (const id of Object.keys(manifest)) delete manifest[id]
    fileMessages.clear()

    for (const sourceRoot of sourceRoots) {
      if (!existsSync(sourceRoot)) continue
      for (const file of collectScanFiles(sourceRoot).sort()) {
        const code = readFileSync(file, "utf-8")
        syncSourceCode(file, code)
      }
    }
  }

  function toRootRelativePath(file: string) {
    return relative(root, file).replaceAll("\\", "/")
  }

  function createVirtualMessagesModule() {
    if (isRemoteOfflineDev(resolvedRuntime, isDev)) {
      return createModuleMessagesModule(locales, (locale) => `/${normalizePath(toRootRelativePath(getLocalePath(locale)))}`)
    }
    if (resolvedRuntime.type === "remote") return createRemoteMessagesModule(resolvedRuntime, locales, remoteUrl)
    if (resolvedRuntime.target === "public") return createPublicMessagesModule(locales, publicBasePath)
    return createModuleMessagesModule(locales, (locale) => `/${normalizePath(toRootRelativePath(getLocalePath(locale)))}`)
  }

  return {
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
      root = config.root
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
      const localEditorOptions = getLocalEditorOptions({ isDev, runtime: resolvedRuntime })
      if (localEditorOptions) {
        configureLocalEditor(
          server,
          { defaultLocale, isUntranslatedLocaleValue, locales, log, manifest, readLocaleMessages, writeLocaleMessages },
          localEditorOptions,
        )
      }
      server.watcher.add(sourceRoots)
      server.httpServer?.once("listening", () => scheduleDevRemoteSync())

      const syncFileFromDisk = (file: string) => {
        if (!shouldScanFile(file) || !existsSync(file)) return
        applySyncResult(syncSourceCode(file, readFileSync(file, "utf-8")), { scheduleTranslation: true })
        scheduleDevRemoteSync()
      }

      const removeFileFromManifest = (file: string) => {
        if (!shouldScanFile(file)) return
        applySyncResult(removeTrackedFile(file), { scheduleTranslation: true })
        scheduleDevRemoteSync()
      }

      server.watcher.on("add", syncFileFromDisk)
      server.watcher.on("change", syncFileFromDisk)
      server.watcher.on("unlink", removeFileFromManifest)
    },

    transform(code, id) {
      const cleanId = id.split("?", 1)[0] ?? id
      if (!shouldScanFile(cleanId)) return

      const analysis = analyzeSourceFile(code, cleanId, {
        call: CALL_MARKERS,
        component: COMPONENT_MARKERS,
        logging,
      })

      if (analysis.edits.length === 0) return
      return {
        code: applyEdits(code, analysis.edits),
        map: null,
      }
    },

    async generateBundle() {
      if (usesLocalStorage) {
        assertLocalBuildTranslationsComplete()
      } else if (isDev) {
        await translateMissingMessages()
      }

      if (!usesLocalStorage) {
        await syncRemote()
      }
    },

    closeBundle() {
      if (usesLocalStorage && !isDev) return
      saveCache(resolve(root, cacheFile), cache)
    },
  }
}

function formatLocaleIssue(locale: string, label: string, ids: string[]) {
  const preview = ids
    .slice(0, 5)
    .map((id) => JSON.stringify(id))
    .join(", ")
  const suffix = ids.length > 5 ? `, ... ${ids.length - 5} more` : ""
  return `- ${locale}: ${label} (${preview}${suffix})`
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
  if (runtime) return runtime.type === "local" ? { ...runtime, target: runtime.target ?? "module" } : runtime
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

function normalizeLocaleMessages(input: unknown): RuntimeMessages {
  if (isRuntimeMessages(input)) return input
  if (
    typeof input === "object" &&
    input !== null &&
    "messages" in input &&
    typeof input.messages === "object" &&
    input.messages !== null
  ) {
    return Object.fromEntries(
      Object.entries(input.messages).flatMap(([id, entry]) =>
        typeof entry === "object" && entry !== null && "translation" in entry && typeof entry.translation === "string"
          ? [[id, entry.translation]]
          : [],
      ),
    ) as RuntimeMessages
  }
  return {}
}

function writeFileIfChanged(path: string, contents: string) {
  if (existsSync(path) && readFileSync(path, "utf-8") === contents) return false
  writeFileSync(path, contents)
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
    files.push(path)
  }
  return files
}

function isRuntimeMessages(input: unknown): input is RuntimeMessages {
  return typeof input === "object" && input !== null && Object.values(input).every((value) => typeof value === "string")
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
  return left.file === right.file && left.kind === right.kind && left.marker === right.marker
}

function compareManifestEntryIds([left]: [string, ManifestEntry], [right]: [string, ManifestEntry]) {
  return left.localeCompare(right)
}

function compareMessageSources(left: MessageSource, right: MessageSource) {
  return left.file.localeCompare(right.file) || left.kind.localeCompare(right.kind) || left.marker.localeCompare(right.marker)
}

function isSameExtractedMessage(left: ExtractedMessage, right?: ExtractedMessage) {
  if (!right) return false
  return hasSameMessageShape(left, right) && isSameSource(left.source, right.source)
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
