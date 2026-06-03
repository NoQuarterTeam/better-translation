/** A single extracted message discovered during source scanning. */
export interface ExtractedMessage {
  /** Stable lookup id used for lookups and locale file keys. */
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
  kind: "call" | "component"
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

/** In-memory manifest keyed by stable lookup id. */
export type MessageManifest = Record<string, ManifestEntry>

/** Private on-disk manifest keyed by stable lookup id. */
export type MessageManifestFile = MessageManifest

/** Flat runtime message map keyed by stable lookup id. */
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
  /** Locale entries keyed by stable lookup id. */
  messages: Record<string, LocaleMessageEntry>
}

/** Translation cache persisted between runs to avoid re-translating unchanged messages. */
export interface TranslationCache {
  /** Cache schema version used for invalidation. */
  version: number
  /** Cached translations keyed by stable lookup id and locale. */
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
  /** Explicit stable lookup id for direct runtime lookups, whether provided manually or by a transform. */
  id?: string
  /** Extra disambiguating context for translators and custom ids. */
  context?: string
}

/** A full message payload passed to the translate callback. */
export interface TranslateMessage {
  /** Stable lookup id used for locale file keys and translation results. */
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
export type TranslateFn = (messages: TranslateMessage[], locale: string) => Promise<Record<string, string>>

/** Writes locale files into the app and loads them through Vite. */
export interface BetterTranslateLocalRuntimeOptions {
  /** Selects local runtime artifacts. */
  type: "local"
  /** Chooses whether locale files are imported as modules or fetched from Vite public assets. */
  target?: "module" | "public"
  /** Output directory where locale artifacts are written. */
  output?: string
  /** Public URL prefix used by the generated loader for `target: "public"`. */
  basePath?: string
  /** Custom translation function used for messages missing from non-default locales. */
  translate?: TranslateFn
}

/** Loads locale files from an external translation service. */
export interface BetterTranslateRemoteRuntimeOptions {
  /** Selects remote runtime loading. */
  type: "remote"
  /** Remote translation service URL. */
  endpoint?: string
  /** Remote project identifier. */
  projectId: string
  /** Project API key used by the Vite plugin to sync Manifests. Falls back to `BETTER_TRANSLATION_API_KEY`. */
  apiKey?: string
  /** Branch to read from, or `"auto"` to infer it from the environment. */
  branch?: "auto" | (string & {})
  /** Local development behavior for remote runtime mode. */
  dev?: {
    /** Avoid platform reads and writes during local development. */
    offline?: boolean
  }
}

/** Controls where locale artifacts live and how the virtual runtime loader reads them. */
export type BetterTranslateRuntimeOptions = BetterTranslateLocalRuntimeOptions | BetterTranslateRemoteRuntimeOptions

/** Public configuration for the Better Translation Vite plugin. */
export interface BetterTranslatePluginOptions {
  /** All locale codes that should be emitted. */
  locales: string[]
  /** Locale code treated as the source language. */
  defaultLocale?: string
  /** Source directory or directories, relative to the Vite root. Defaults to `"src"`. */
  rootDir?: string | string[]
  /** Cache file path, relative to the Vite root. */
  cacheFile?: string
  /** Enables or disables plugin logging. */
  logging?: boolean
  /** Runtime backend configuration. */
  runtime?: BetterTranslateRuntimeOptions
}
