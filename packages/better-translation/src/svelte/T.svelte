<script lang="ts">
  import type { Snippet } from "svelte"

  import {
    getMessage,
    getMessagesReader,
    normalizeValues,
    parseSvelteRichTextMessage,
    resolveSvelteRichTextNodes,
    type RichTextMessageNode,
  } from "../svelte-runtime.mjs"

  interface Props {
    id?: string
    context?: string
    message?: string
    values?: Record<string, unknown>
    children?: Snippet
    [name: `__better_translation_${number}`]: Snippet<[Snippet]> | undefined
  }

  let { id, message, values, children, ...richTextElements }: Props = $props()

  const readMessages = getMessagesReader()
  const messages = $derived(readMessages())

  const template = $derived(id !== undefined ? getMessage(messages, id) : undefined)
  const normalizedValues = $derived(normalizeValues(values))
  const sourceMessage = $derived(message ? parseSvelteRichTextMessage(message) : undefined)
  const translatedMessage = $derived(template ? parseSvelteRichTextMessage(template) : undefined)
  const hasRichTextElements = $derived.by(() => {
    if (!sourceMessage) return false
    for (const index of sourceMessage.structure.elements.keys()) {
      if (!richTextElements[`__better_translation_${index}`]) return false
    }
    return true
  })
  const richTextNodes = $derived(
    hasRichTextElements ? resolveSvelteRichTextNodes(sourceMessage, translatedMessage) : undefined,
  )
</script>

{#snippet renderNodes(nodes: RichTextMessageNode[])}
  {#each nodes as node (node.key)}
    {#if node.type === "text"}
      {node.value}
    {:else if node.type === "variable"}
      {normalizedValues && Object.hasOwn(normalizedValues, node.name)
        ? normalizedValues[node.name]
        : `{${node.name}}`}
    {:else}
      {#snippet translatedChildren()}
        {@render renderNodes(node.children)}
      {/snippet}
      {@render richTextElements[`__better_translation_${node.index}`]?.(translatedChildren)}
    {/if}
  {/each}
{/snippet}

{#if richTextNodes}
  {@render renderNodes(richTextNodes)}
{:else}
  {@render children?.()}
{/if}
