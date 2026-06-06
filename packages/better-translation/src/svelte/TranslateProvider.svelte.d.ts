import type { Component, Snippet } from "svelte"

declare const TranslateProvider: Component<{
  messages: Record<string, string>
  children?: Snippet
}>

export default TranslateProvider
