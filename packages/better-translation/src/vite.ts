/**
 * Vite plugin entry point for discovering Translation markers, maintaining the
 * Manifest, and generating or loading Runtime bundles.
 *
 * @packageDocumentation
 */
export { betterTranslation } from "./vite-plugin/index.js"
export type {
  BetterTranslateLocalEditorOptions,
  BetterTranslateLocalRuntimeOptions,
  BetterTranslatePluginOptions,
  BetterTranslateRemoteRuntimeOptions,
  BetterTranslateRuntimeOptions,
  TranslateFn,
  TranslateMessage,
  TranslateOptions,
} from "./types.js"
