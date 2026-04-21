import { getCallMessageId, type TranslateOptions } from "@better-translate/core"

/** A server-side placeholder value used by `msg()` template interpolation. */
export interface VarResult {
  /** Internal marker used to identify placeholder values. */
  __i18n: true
  /** Placeholder name used inside the translated template. */
  name: string
  /** Runtime value that should replace the placeholder. */
  value: unknown
}

/** Marks a value for replacement into a translated server-side template message. */
export function v(name: string, value: unknown): VarResult {
  return { __i18n: true, name, value }
}

/** The server-side translation helpers returned by `createTranslator()`. */
export interface ServerTranslator {
  /** Translates a plain string in non-JSX contexts such as errors or email helpers. */
  t: (id: string, options?: TranslateOptions) => string
  /** Translates a template message with runtime placeholders. */
  msg: (id: string) => (strings: TemplateStringsArray, ...expressions: VarResult[]) => string
}

/** Creates lightweight server-side translation helpers from a loaded message map. */
export function createTranslator(messages: Record<string, string>): ServerTranslator {
  function t(id: string, options?: TranslateOptions) {
    return messages[getCallMessageId(id, options)] ?? id
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

      const values = Object.fromEntries(
        expressions.filter((expr): expr is VarResult => Boolean(expr?.__i18n)).map((expr) => [expr.name, String(expr.value)]),
      )
      return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
    }
  }

  return { t, msg }
}
