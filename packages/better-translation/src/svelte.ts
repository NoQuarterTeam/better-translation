/**
 * Svelte Translation markers and runtime helpers.
 *
 * @packageDocumentation
 */
export { default as T } from "./svelte/T.svelte"
export { default as TranslateProvider } from "./svelte/TranslateProvider.svelte"
export { default as Var } from "./svelte/Var.svelte"
export { getMessages, getT } from "./svelte/runtime.js"
export type { TranslateProviderProps } from "./svelte/runtime.js"
