import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { ViteDevServer } from "vite"

import type { BetterTranslateRuntimeOptions, ManifestEntry, MessageManifest, RuntimeMessages } from "../types.js"

export const DEFAULT_LOCAL_EDITOR_PATH = "/__better-translation"

const CYAN = "\x1b[36m"
const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
const RESET = "\x1b[0m"

type LocalEditorOptions = {
  open: boolean
  path: string
}

export type LocalEditorRuntimeContext = {
  defaultLocale: string
  isUntranslatedLocaleValue: (value: string, entry: Pick<ManifestEntry, "defaultMessage">) => boolean
  locales: string[]
  log: (message: string) => void
  manifest: MessageManifest
  readLocaleMessages: (locale: string) => RuntimeMessages
  writeLocaleMessages: (locale: string, localeMessages: RuntimeMessages) => void
}

export function getLocalEditorOptions({
  isDev,
  runtime,
}: {
  isDev: boolean
  runtime: BetterTranslateRuntimeOptions
}): LocalEditorOptions | null {
  if (!isDev || runtime.type !== "local") return null
  const editor = runtime.editor
  if (!editor) return null
  if (editor === true) return { path: DEFAULT_LOCAL_EDITOR_PATH, open: false }
  if (editor.enabled === false) return null
  return {
    path: normalizeLocalEditorPath(editor.path ?? DEFAULT_LOCAL_EDITOR_PATH),
    open: editor.open ?? false,
  }
}

export function configureLocalEditor(server: ViteDevServer, context: LocalEditorRuntimeContext, options: LocalEditorOptions) {
  const editorPath = options.path
  server.middlewares.use(async (request, response, next) => {
    const requestUrl = new URL(request.url ?? "/", "http://better-translation.local")
    const pathname = stripTrailingSlash(requestUrl.pathname)
    if (pathname !== editorPath && !pathname.startsWith(`${editorPath}/`)) {
      next()
      return
    }

    try {
      if (pathname === editorPath || pathname === `${editorPath}/index.html`) {
        sendHtml(response, createLocalEditorHtml(editorPath))
        return
      }

      if (pathname === `${editorPath}/client.js`) {
        sendJavaScript(response, readLocalEditorAsset("local-editor.js"))
        return
      }

      if (pathname === `${editorPath}/style.css`) {
        sendCss(response, readLocalEditorAsset("style.css"))
        return
      }

      if (pathname.startsWith(`${editorPath}/local-editor-assets/`)) {
        const assetName = pathname.slice(`${editorPath}/local-editor-assets/`.length)
        sendAsset(response, assetName)
        return
      }

      if (pathname === `${editorPath}/api/messages` && request.method === "GET") {
        sendJson(
          response,
          getLocalEditorMessages(context, {
            q: requestUrl.searchParams.get("q") ?? undefined,
            view: parseLocalEditorView(requestUrl.searchParams.get("view")),
          }),
        )
        return
      }

      const detailMatch = pathname.match(new RegExp(`^${escapeRegExp(editorPath)}/api/messages/([^/]+)$`))
      if (detailMatch?.[1] && request.method === "GET") {
        sendJson(response, getLocalEditorMessageDetail(context, decodeURIComponent(detailMatch[1])))
        return
      }

      const updateMatch = pathname.match(new RegExp(`^${escapeRegExp(editorPath)}/api/messages/([^/]+)/locales/([^/]+)$`))
      if (updateMatch?.[1] && updateMatch[2] && request.method === "PATCH") {
        const body = await readJsonRequest(request)
        const value =
          typeof body === "object" && body !== null && "value" in body && typeof body.value === "string" ? body.value.trim() : ""
        if (!value) {
          sendJson(response, { error: "Locale value is required." }, 400)
          return
        }
        updateLocalEditorLocaleValue(context, {
          locale: decodeURIComponent(updateMatch[2]),
          lookupId: decodeURIComponent(updateMatch[1]),
          value,
        })
        sendJson(response, getLocalEditorMessageDetail(context, decodeURIComponent(updateMatch[1])))
        return
      }

      sendJson(response, { error: "Not found." }, 404)
    } catch (error) {
      sendJson(response, { error: error instanceof Error ? error.message : "Local editor request failed." }, 500)
    }
  })

  server.httpServer?.once("listening", () => {
    const localUrl = server.resolvedUrls?.local[0]
    const editorUrl = localUrl ? new URL(editorPath, localUrl).toString() : editorPath
    context.log(`${PREFIX} Local editor: ${CYAN}${editorUrl}${RESET}`)
    if (options.open) openLocalEditor(editorUrl)
  })
}

function getLocalEditorMessages(
  context: LocalEditorRuntimeContext,
  { q, view }: { q?: string; view: "all" | "needs-value" | "manual" | "ai" },
) {
  const query = q?.trim().toLowerCase()
  const localeMessagesByLocale = readEditableLocaleMessages(context)
  const summaries = Object.entries(context.manifest)
    .sort(compareManifestEntryIds)
    .map(([id, entry]) => getLocalEditorMessageSummary(context, localeMessagesByLocale, id, entry))
  const filteredMessages = summaries.filter((message) => {
    if (query) {
      const searchableValues = [
        message.defaultMessage,
        ...Object.values(localeMessagesByLocale).map((localeMessages) => localeMessages[message.id] ?? ""),
      ]
      if (!searchableValues.some((value) => value.toLowerCase().includes(query))) return false
    }
    if (view === "all") return true
    if (view === "needs-value") return message.done < message.total
    if (view === "ai") return false
    return Object.values(localeMessagesByLocale).some((localeMessages) => localeMessages[message.id] !== undefined)
  })

  return {
    config: {
      appLocale: context.defaultLocale,
      defaultLocale: context.defaultLocale,
      locales: context.locales,
    },
    incompleteCount: summaries.filter((message) => message.done < message.total).length,
    messages: filteredMessages.map(({ defaultMessage, done, id, lookupId, placeholders, total }) => ({
      defaultMessage,
      done,
      id,
      lookupId,
      placeholders,
      total,
    })),
  }
}

function readEditableLocaleMessages(context: LocalEditorRuntimeContext) {
  return Object.fromEntries(
    context.locales
      .filter((locale) => locale !== context.defaultLocale)
      .map((locale) => [locale, context.readLocaleMessages(locale)]),
  )
}

function getLocalEditorMessageSummary(
  context: LocalEditorRuntimeContext,
  localeMessagesByLocale: Record<string, RuntimeMessages>,
  id: string,
  entry: ManifestEntry,
) {
  const editableLocales = context.locales.filter((locale) => locale !== context.defaultLocale)

  return {
    defaultMessage: entry.defaultMessage,
    done: editableLocales.filter((locale) => localeMessagesByLocale[locale]?.[id] !== undefined).length,
    id,
    lookupId: id,
    placeholders: entry.placeholders,
    total: editableLocales.length,
  }
}

function getLocalEditorMessageDetail(context: LocalEditorRuntimeContext, id: string) {
  const entry = context.manifest[id]
  if (!entry) throw new Error("Unknown Message.")
  const localeValues = Object.fromEntries(
    context.locales.map((locale) => {
      if (locale === context.defaultLocale) {
        return [locale, { value: entry.defaultMessage, source: "default", hasValue: true }]
      }

      const localeMessages = context.readLocaleMessages(locale)
      const value = localeMessages[id]
      const hasValue = value !== undefined
      return [locale, { value: value ?? entry.defaultMessage, source: hasValue ? "manual" : "default", hasValue }]
    }),
  )
  const editableValues = Object.entries(localeValues).filter(([locale]) => locale !== context.defaultLocale)

  return {
    context: typeof entry.meta.context === "string" ? entry.meta.context : null,
    defaultMessage: entry.defaultMessage,
    done: editableValues.filter(([, value]) => value.hasValue).length,
    id,
    localeValues,
    lookupId: id,
    placeholders: entry.placeholders,
    sources: entry.sources,
    total: editableValues.length,
  }
}

function updateLocalEditorLocaleValue(
  context: LocalEditorRuntimeContext,
  { locale, lookupId, value }: { locale: string; lookupId: string; value: string },
) {
  if (locale === context.defaultLocale) throw new Error("Default locale Messages come from source code.")
  if (!context.locales.includes(locale)) throw new Error("Unknown Locale.")
  if (!context.manifest[lookupId]) throw new Error("Unknown Message.")

  const localeMessages = context.readLocaleMessages(locale)
  localeMessages[lookupId] = value
  context.writeLocaleMessages(locale, localeMessages)
}

function createLocalEditorHtml(editorPath: string) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>Better Translation Local Editor</title>",
    "</head>",
    "<body>",
    '<div id="root"></div>',
    `<link rel="stylesheet" href="${editorPath}/style.css" />`,
    `<script defer src="${editorPath}/client.js"></script>`,
    "</body>",
    "</html>",
  ].join("\n")
}

function sendHtml(response: ServerResponse, html: string) {
  response.statusCode = 200
  response.setHeader("content-type", "text/html; charset=utf-8")
  response.end(html)
}

function sendJavaScript(response: ServerResponse, code: string) {
  response.statusCode = 200
  response.setHeader("content-type", "application/javascript; charset=utf-8")
  response.end(code)
}

function sendCss(response: ServerResponse, css: string) {
  response.statusCode = 200
  response.setHeader("content-type", "text/css; charset=utf-8")
  response.end(css)
}

function sendAsset(response: ServerResponse, assetName: string) {
  if (!/^[\w.-]+$/.test(assetName)) {
    sendJson(response, { error: "Not found." }, 404)
    return
  }

  response.statusCode = 200
  response.setHeader("content-type", getAssetContentType(assetName))
  response.end(readFileSync(new URL(`./local-editor-assets/${assetName}`, import.meta.url)))
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200) {
  response.statusCode = statusCode
  response.setHeader("content-type", "application/json; charset=utf-8")
  response.end(JSON.stringify(payload))
}

async function readJsonRequest(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as unknown
}

function parseLocalEditorView(value: string | null): "all" | "needs-value" | "manual" | "ai" {
  if (value === "needs-value" || value === "manual" || value === "ai") return value
  return "all"
}

function normalizeLocalEditorPath(path: string) {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`
  return stripTrailingSlash(withLeadingSlash)
}

function stripTrailingSlash(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, "") : path
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function openLocalEditor(url: string) {
  try {
    if (process.platform === "darwin") execFileSync("open", [url], { stdio: "ignore" })
    else if (process.platform === "win32") execFileSync("cmd", ["/c", "start", "", url], { stdio: "ignore" })
    else execFileSync("xdg-open", [url], { stdio: "ignore" })
  } catch {
    // Opening the browser is a convenience only.
  }
}

function readLocalEditorAsset(fileName: "local-editor.js" | "style.css") {
  return readFileSync(new URL(`./${fileName}`, import.meta.url), "utf-8")
}

function getAssetContentType(assetName: string) {
  if (assetName.endsWith(".woff2")) return "font/woff2"
  if (assetName.endsWith(".woff")) return "font/woff"
  if (assetName.endsWith(".css")) return "text/css; charset=utf-8"
  if (assetName.endsWith(".js")) return "application/javascript; charset=utf-8"
  if (assetName.endsWith(".svg")) return "image/svg+xml"
  return "application/octet-stream"
}

function compareManifestEntryIds([left]: [string, ManifestEntry], [right]: [string, ManifestEntry]) {
  return left.localeCompare(right)
}
