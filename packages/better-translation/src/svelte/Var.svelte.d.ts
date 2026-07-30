import type { Component } from "svelte"

/**
 * Marks a runtime value for placeholder interpolation inside the Svelte `T`
 * component.
 *
 * Pass one named shorthand prop such as `<Var {count} />`, or use explicit
 * `name` and `value` props. Values remain authored runtime values and are never
 * parsed as translated HTML.
 */
declare const Var: Component<Record<string, unknown>>

export default Var
