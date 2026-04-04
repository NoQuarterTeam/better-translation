export interface ExtractedMessage {
  id: string
  defaultMessage: string
  placeholders: string[]
  file: string
}

export interface ManifestEntry {
  defaultMessage: string
  placeholders: string[]
  files: string[]
}

export type MessageManifest = Record<string, ManifestEntry>

export interface TranslationCache {
  version: number
  entries: Record<
    string,
    {
      sourceText: string
      locale: string
      translation: string
      timestamp: number
    }
  >
}

export type TranslateFn = (messages: Record<string, string>, locale: string) => Promise<Record<string, string>>

export interface I18nScanOptions {
  roots?: string[]
  extensions?: string[]
}

export type I18nStorageOptions =
  | {
      type: "hosted"
      url?: string
    }
  | {
      type: "local"
      dir?: string
    }

export interface I18nPluginOptions {
  locales: string[]
  defaultLocale?: string
  cacheFile?: string
  scan?: I18nScanOptions
  storage?: I18nStorageOptions
  markers?: {
    call?: string[]
    component?: string[]
    taggedTemplate?: string[]
  }
  translate?: TranslateFn
}
