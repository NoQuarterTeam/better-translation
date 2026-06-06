import type { Component, Snippet } from "svelte"

declare const T: Component<{
  id?: string
  context?: string
  message?: string
  values?: Record<string, unknown>
  children?: Snippet
}>

export default T
