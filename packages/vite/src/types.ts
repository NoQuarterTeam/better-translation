/** A single extracted message discovered during source scanning. */
export interface ExtractedMessage {
  /** Stable message id used for lookups and locale file keys. */
  id: string
  /** Source-language text that should be translated. */
  defaultMessage: string
  /** Optional metadata that affects translation or message grouping. */
  meta: TranslateOptions
  /** Placeholder names discovered in the message text. */
  placeholders: string[]
  /** Rich source metadata for the extracted occurrence. */
  source: MessageSource
}

/** Source metadata for a single extracted message occurrence. */
export interface MessageSource {
  /** File path relative to the Vite root where the message came from. */
  file: string
  /** Extraction marker that produced the message. */
  kind: "call" | "component" | "tagged-template"
  /** Concrete marker name encountered in source, such as `t` or `T`. */
  marker: string
  /** 1-based starting line number of the extracted node. */
  line: number
  /** 1-based starting column number of the extracted node. */
  column: number
  /** 1-based ending line number of the extracted node. */
  endLine: number
  /** 1-based ending column number of the extracted node. */
  endColumn: number
  /** Zero-based starting byte offset in the source file. */
  start: number
  /** Zero-based ending byte offset in the source file. */
  end: number
}

/** Internal manifest entry used while aggregating extracted messages. */
export interface ManifestEntry {
  /** Source-language text that should be translated. */
  defaultMessage: string
  /** Optional metadata that affects translation or message grouping. */
  meta: TranslateOptions
  /** Placeholder names discovered in the message text. */
  placeholders: string[]
  /** Source locations that contributed to this manifest entry. */
  sources: MessageSource[]
}

/** In-memory manifest keyed by stable message id. */
export type MessageManifest = Record<string, ManifestEntry>

/** Private on-disk manifest keyed by stable message id. */
export type MessageManifestFile = MessageManifest

/** Flat runtime message map keyed by stable message id. */
export type RuntimeMessages = Record<string, string>

/** A single translated message entry written to a locale file. */
export interface LocaleMessageEntry {
  /** Final translated text for the target locale. */
  translation: string
  /** Original source-language text for reference and re-translation. */
  defaultMessage: string
  /** Optional metadata that affects translation or message grouping. */
  meta: TranslateOptions
  /** Placeholder names discovered in the message text. */
  placeholders: string[]
  /** Source locations that contributed to this locale entry. */
  sources: MessageSource[]
}

/** Legacy on-disk JSON structure emitted by earlier local runtime modes. */
export interface LocaleFile {
  /** Locale code represented by this file. */
  locale: string
  /** Source locale used as the untranslated fallback. */
  defaultLocale: string
  /** Locale entries keyed by stable message id. */
  messages: Record<string, LocaleMessageEntry>
}

/** Translation cache persisted between runs to avoid re-translating unchanged messages. */
export interface TranslationCache {
  /** Cache schema version used for invalidation. */
  version: number
  /** Cached translations keyed by stable message id and locale. */
  entries: Record<
    string,
    {
      /** Original source-language text used to generate the translation. */
      sourceText: string
      /** Metadata that was present when the translation was generated. */
      meta: TranslateOptions
      /** Locale code the translation was generated for. */
      locale: string
      /** Cached translated text. */
      translation: string
      /** Unix timestamp in milliseconds when the translation was cached. */
      timestamp: number
    }
  >
}

/** Extra metadata that can influence translation and message grouping. */
export interface TranslateOptions {
  /** Explicit stable message id for direct runtime lookups, whether provided manually or by a transform. */
  id?: string
  /** Extra disambiguating context for translators and custom ids. */
  context?: string
}

/** A full message payload passed to the translate callback. */
export interface TranslateMessage {
  /** Stable message id used for locale file keys and translation results. */
  id: string
  /** Source-language text that should be translated. */
  text: string
  /** Optional metadata that affects translation or message grouping. */
  meta: TranslateOptions
  /** Placeholder names discovered in the message text. */
  placeholders: string[]
  /** Source locations that produced this message. */
  sources: MessageSource[]
}

/** User-provided translation function used to fill missing locale entries. */
export type TranslateFn = (
  /** Messages that are missing translations for the requested locale. */
  messages: TranslateMessage[],
  /** Locale code the messages should be translated into. */
  locale: string,
) => Promise<Record<string, string>>

/** Controls which files the plugin should scan for messages. */
export interface BetterTranslateScanOptions {
  /** Root directories, relative to the Vite root, that should be scanned. */
  roots?: string[]
  /** File extensions that should be parsed for translation markers. */
  extensions?: string[]
}

/** Stores messages in a hosted backend. */
export interface BetterTranslateHostedStorageOptions {
  /** Selects hosted storage. */
  type: "hosted"
  /** Optional hosted backend URL. */
  url?: string
}

/** Stores locale JSON files in the local app or deployed artifact. */
export interface BetterTranslateLocalStorageOptions {
  /** Selects local JSON file output. */
  type: "local"
  /** Directory where locale JSON files are written. */
  dir?: string
}

/** Controls where translated locale artifacts are written or synced. */
export type BetterTranslateStorageOptions = BetterTranslateHostedStorageOptions | BetterTranslateLocalStorageOptions

/** Runtime metadata emitted by the plugin for server-side loaders. */
export interface BetterTranslateRuntimeConfig {
  /** Storage backend configured for emitted locale artifacts. */
  storage: BetterTranslateStorageOptions
  /** Locale code treated as the source language. */
  defaultLocale: string
  /** All locale codes emitted by the plugin. */
  locales: string[]
}

/** Public configuration for the Better Translate Vite plugin. */
export interface BetterTranslatePluginOptions {
  /** All locale codes that should be emitted. */
  locales: string[]
  /** Locale code treated as the source language. */
  defaultLocale?: string
  /** Cache file path, relative to the Vite root. */
  cacheFile?: string
  /** Enables or disables plugin logging. */
  logging?: boolean
  /** File scanning configuration. */
  scan?: BetterTranslateScanOptions
  /** Storage backend configuration. */
  storage?: BetterTranslateStorageOptions
  /** Custom marker names to extract from source code. */
  markers?: {
    /** Function names that should be treated like `t("...")`. */
    call?: string[]
    /** JSX component names that should be treated like `<T>...</T>`. */
    component?: string[]
    /** Tagged template helpers that should be treated like `msg("id")\`...\``. */
    taggedTemplate?: string[]
  }
  /** Custom translation function used for messages missing from non-default locales. */
  translate?: TranslateFn
}
