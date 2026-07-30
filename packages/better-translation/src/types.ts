/** One Message discovered by Vite-plugin source analysis. */
export interface ExtractedMessage {
  /** Stable Lookup id used in the Manifest and Runtime bundles. */
  id: string
  /** Authored Default locale Message. */
  defaultMessage: string
  /** Message identity and translator context. */
  meta: TranslateOptions
  /** Placeholder names discovered in the Default locale Message. */
  placeholders: string[]
  /** Durable source ownership for this Translation marker occurrence. */
  source: MessageSource
}

/** Durable source ownership for one Translation marker occurrence. */
export interface MessageSource {
  /** File path relative to the Vite root containing the Translation marker. */
  file: string
  /** Translation marker syntax that produced the Message. */
  kind: "call" | "component"
  /** Concrete marker name found in source, such as `t` or `T`. */
  marker: string
}

/** Internal Manifest entry aggregated from every occurrence of one Lookup id. */
export interface ManifestEntry {
  /** Authored Default locale Message. */
  defaultMessage: string
  /** Message identity and translator context. */
  meta: TranslateOptions
  /** Placeholder names discovered in the Default locale Message. */
  placeholders: string[]
  /** Source occurrences that contributed to this Manifest entry. */
  sources: MessageSource[]
}

/** In-memory Manifest keyed by Lookup id. */
export type MessageManifest = Record<string, ManifestEntry>

/**
 * Private Manifest persisted by the Vite plugin, keyed by Lookup id.
 *
 * A Manifest contains source metadata used for synchronization and editing. It
 * is separate from the flat {@link RuntimeMessages} payload loaded by Consumer
 * apps.
 */
export type MessageManifestFile = MessageManifest

/** Flat Runtime bundle of Locale values keyed by Lookup id. */
export type RuntimeMessages = Record<string, string>

/** Translation cache persisted between runs to avoid re-translating unchanged messages. */
export interface TranslationCache {
  /** Cache schema version used for invalidation. */
  version: number
  /** Cached Locale values keyed by Lookup id and Locale. */
  entries: Record<
    string,
    {
      /** Default locale Message used to generate the Locale value. */
      sourceText: string
      /** Message identity and translator context used during generation. */
      meta: TranslateOptions
      /** Locale for which the value was generated. */
      locale: string
      /** Cached Locale value. */
      translation: string
      /** Unix timestamp in milliseconds when the translation was cached. */
      timestamp: number
    }
  >
}

/** Options that disambiguate or explicitly identify a Message. */
export interface TranslateOptions {
  /** Explicit Lookup id to use instead of the stable id generated from Message content and context. */
  id?: string
  /** Disambiguating information for translators and otherwise-identical Messages with different meanings. */
  context?: string
}

/** One Message passed to a local-mode {@link TranslateFn}. */
export interface TranslateMessage {
  /** Stable Lookup id that the callback uses as its result key. */
  id: string
  /** Default locale Message to translate, including placeholders and numbered rich-text tags. */
  text: string
  /** Message identity and translator context. */
  meta: TranslateOptions
  /** Placeholder names that the returned Locale value must preserve. */
  placeholders: string[]
  /** Translation marker occurrences that produced this Message. */
  sources: MessageSource[]
}

/**
 * Fills missing non-default Locale values in local mode.
 *
 * The Vite plugin calls this function with one configured batch and target
 * Locale at a time. Return translated values keyed by each Message's Lookup id;
 * omitted ids remain missing. Returned values are trimmed and must preserve the
 * source Message's placeholders and numbered rich-text structure.
 *
 * @param messages - Missing Messages in the current translation batch.
 * @param locale - Target Locale configured in the Vite plugin.
 * @returns Translated Locale values keyed by Lookup id.
 */
export type TranslateFn = (messages: TranslateMessage[], locale: string) => Promise<Record<string, string>>

/** Configuration for the dev-only local Locale value editor. */
export interface BetterTranslateLocalEditorOptions {
  /** Enables the editor during `vite dev`. Defaults to `true` when an options object is supplied. */
  enabled?: boolean
  /** Vite dev-server path used by the editor. Defaults to `"/__better-translation"`. */
  path?: string
  /** Opens the editor when the dev server starts. Defaults to `false`. */
  open?: boolean
}

interface BetterTranslateLocalRuntimeBaseOptions {
  /** Selects repo-owned local Runtime bundles. */
  type: "local"
  /** Imports Runtime bundles as modules or fetches them from Vite public assets. Defaults to `"module"`. */
  target?: "module" | "public"
  /**
   * Output directory for generated Runtime bundles, relative to the Vite root.
   *
   * Defaults to `"src/lib/bt"` for the module target and `<publicDir>/bt` for
   * the public target.
   */
  output?: string
  /** Public URL prefix for `target: "public"`. By default it is inferred from `output` and Vite's `publicDir`. */
  basePath?: string
  /** Enables or configures the local Locale value editor during `vite dev`. */
  editor?: boolean | BetterTranslateLocalEditorOptions
}

/**
 * Configures repo-owned local Runtime bundles.
 *
 * During development the Vite plugin maintains flat Runtime bundles and can
 * fill missing values through {@link TranslateFn}. Local production builds are
 * check-only and fail when committed artifacts are stale, incomplete, invalid,
 * or contain Lookup ids that are absent from the current Manifest.
 */
export type BetterTranslateLocalRuntimeOptions =
  | (BetterTranslateLocalRuntimeBaseOptions & {
      /** Callback used during development to fill missing non-default Locale values. */
      translate: TranslateFn
      /** Number of Messages translated before cache and Locale values are persisted. Defaults to `25`. */
      translationBatchSize?: number
    })
  | (BetterTranslateLocalRuntimeBaseOptions & {
      /** Omit the callback to manage non-default Locale values manually. */
      translate?: undefined
      /** Only available when `translate` is provided. */
      translationBatchSize?: never
    })

/**
 * Configures Manifest synchronization and branch-addressed Runtime bundle
 * loading through the hosted platform.
 */
export interface BetterTranslateRemoteRuntimeOptions {
  /** Selects hosted Manifest sync and Runtime bundle loading. */
  type: "remote"
  /** Hosted-platform base URL. Defaults to the Better Translation service. */
  endpoint?: string
  /** Existing Project whose Manifest and Runtime bundles this Consumer app uses. */
  projectId: string
  /**
   * Project write credential used only by the Vite plugin for Manifest sync.
   *
   * Falls back to `BETTER_TRANSLATION_API_KEY` and is never included in
   * generated runtime code or Runtime bundles.
   */
  apiKey?: string
  /** Branch to sync and load, or `"auto"` to resolve it from the environment and Git. Defaults to `"auto"`. */
  branch?: "auto" | (string & {})
  /** Local development behavior for remote runtime mode. */
  dev?: {
    /** Uses ignored local fallback artifacts and avoids hosted reads and writes during local development. */
    offline?: boolean
  }
}

/** Selects local repo-owned or remote hosted Runtime bundle behavior. */
export type BetterTranslateRuntimeOptions = BetterTranslateLocalRuntimeOptions | BetterTranslateRemoteRuntimeOptions

/**
 * Configures source discovery, the Default locale, supported Locales, and
 * Runtime bundle ownership for `betterTranslation`.
 */
export interface BetterTranslatePluginOptions {
  /** All supported Locale codes. At least one unique, non-empty value is required. */
  locales: string[]
  /** Locale used for authored Messages. Defaults to the first configured Locale. */
  defaultLocale?: string
  /** Directories scanned for Translation markers, relative to the Vite root. Defaults to `"src"`. */
  rootDir?: string | string[]
  /** Local translation cache path, relative to the Vite root. Defaults to `".cache/better-translation/cache.json"`. */
  cacheFile?: string
  /** Enables Vite plugin lifecycle and translation logs. Defaults to `true`. */
  logging?: boolean
  /** Runtime bundle configuration. Defaults to local mode with the module target. */
  runtime?: BetterTranslateRuntimeOptions
}
