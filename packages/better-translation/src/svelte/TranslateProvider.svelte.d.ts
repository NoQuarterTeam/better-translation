import type { Component, Snippet } from "svelte"

/**
 * Makes a loaded Runtime bundle available to Better Translation's Svelte
 * components and helpers. When `locale` is supplied, completed local
 * development translations are applied without remounting the Svelte subtree.
 */
declare const TranslateProvider: Component<{
  /** Active Locale used to apply development-time translation updates without reloading the page. */
  locale?: string
  /** Flat Runtime bundle for the active Locale, keyed by Lookup id. */
  messages: Record<string, string>
  /** Svelte content that reads this Runtime bundle. */
  children?: Snippet
}>

export default TranslateProvider
