import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { I18nStorageOptions } from "./types.js"

export interface VarResult {
  __i18n: true
  name: string
  value: unknown
}

export function v(name: string, value: unknown): VarResult {
  return { __i18n: true, name, value }
}

const HOSTED_API_BASE_URL = "https://better-translate.com"
let warnedHostedStub = false

export async function getMessages(
  locale: string,
  options?: {
    storage?: I18nStorageOptions
  },
): Promise<Record<string, string>> {
  const storage = options?.storage ?? { type: "hosted" as const }

  if (storage.type === "hosted") {
    const hostedMessages = await getHostedMessages(locale, storage.url ?? HOSTED_API_BASE_URL)
    if (hostedMessages) return hostedMessages
  }

  const dir = storage.type === "local" ? (storage.dir ?? process.env.I18N_LOCALES_DIR) : process.env.I18N_LOCALES_DIR
  if (!dir) return {}
  const filePath = resolve(dir, `${locale}.json`)
  if (!existsSync(filePath)) return {}
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, string>
}

async function getHostedMessages(locale: string, hostedUrl: string) {
  const apiKey = process.env.I18N_API_KEY
  if (!apiKey) return null
  if (!warnedHostedStub) {
    warnedHostedStub = true
    console.log(
      `\x1b[36m[i18n]\x1b[0m \x1b[33mstub\x1b[0m hosted runtime fetch via \x1b[2m${hostedUrl}\x1b[0m not implemented yet`,
    )
  }
  void locale
  return null
}

export function createTranslator(messages: Record<string, string>) {
  function t(id: string) {
    return messages[id] ?? id
  }

  function msg(id: string) {
    return (strings: TemplateStringsArray, ...expressions: VarResult[]) => {
      const template = messages[id]

      if (!template) {
        return strings.reduce((acc, str, i) => {
          const expr = expressions[i]
          return acc + str + (expr ? String(expr.value) : "")
        }, "")
      }

      let result = template
      for (const expr of expressions) {
        if (expr?.__i18n) {
          result = result.split(`{${expr.name}}`).join(String(expr.value))
        }
      }
      return result
    }
  }

  return { t, msg }
}
