import type { TranslateFn } from "@better-translate/core"

export type {
  ExtractedMessage,
  ManifestEntry,
  MessageManifest,
  MessageManifestFile,
  MessageSource,
  RuntimeMessages,
  TranslateMessage,
  TranslateOptions,
  TranslationCache,
} from "@better-translate/core"
export type { TranslateFn } from "@better-translate/core"

/** Stores messages in a remote backend. */
export interface BetterTranslateRemoteStorageOptions {
  /** Selects remote storage. */
  type: "remote"
  /** Optional remote backend URL. */
  url?: string
}

/** Bundles locale JSON files into the app source tree or deployed artifact. */
export interface BetterTranslateBundleStorageOptions {
  /** Selects bundled storage. */
  type: "bundle"
  /** Output directory where locale JSON files are written. */
  output?: string
}

/** Controls where translated locale artifacts are written or synced. */
export type BetterTranslateStorageOptions = BetterTranslateRemoteStorageOptions | BetterTranslateBundleStorageOptions

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
  /** Source directory or directories, relative to the Vite root. Defaults to `"src"`. */
  rootDir?: string | string[]
  /** Cache file path, relative to the Vite root. */
  cacheFile?: string
  /** Enables or disables plugin logging. */
  logging?: boolean
  /** Storage backend configuration. */
  storage?: BetterTranslateStorageOptions
  /** Custom translation function used for messages missing from non-default locales. */
  translate?: TranslateFn
}
