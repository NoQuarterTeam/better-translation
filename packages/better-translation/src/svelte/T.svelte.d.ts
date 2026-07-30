import type { Component, Snippet } from "svelte"

/** Values accepted by the Svelte `T` Translation marker. */
type TProps = {
  /** Explicit Lookup id to use instead of the stable id generated from the Message and context. */
  id?: string
  /** Disambiguating information for translators and otherwise-identical Messages with different meanings. */
  context?: string
  /** Authored Svelte content that forms the Default locale Message. */
  children?: Snippet
}

/**
 * Marks authored Svelte content as a Message and renders its active Locale
 * value.
 *
 * Static supported inline elements such as `<strong>`, `<b>`, and `<i>`, plus
 * arbitrary source-owned Svelte components, are represented as numbered
 * rich-text tags in the Message. At runtime `T` invokes only Vite-plugin-generated
 * Snippets for the authored elements and components, retaining their authored
 * props and behavior. Locale values are never rendered as arbitrary HTML.
 * Nested elements are supported, and an invalid translated structure safely
 * falls back to the authored content.
 */
declare const T: Component<TProps>

export default T
