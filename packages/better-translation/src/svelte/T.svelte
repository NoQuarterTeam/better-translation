<script lang="ts">
  import type { Snippet } from "svelte"

  import { getMessages } from "../svelte-runtime.mjs"
  import { interpolateString, normalizeValues } from "../runtime.mjs"

  interface Props {
    id?: string
    context?: string
    message?: string
    values?: Record<string, unknown>
    children?: Snippet
  }

  let { id, message, values, children }: Props = $props()

  const messages = $derived(getMessages())

  const template = $derived(id ? messages[id] : undefined)
  const translated = $derived(template ? interpolateString(template, normalizeValues(values)) : undefined)
</script>

{#if translated}
  {translated}
{:else if message}
  {interpolateString(message, normalizeValues(values))}
{:else}
  {@render children?.()}
{/if}
