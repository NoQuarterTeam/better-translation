<script lang="ts">
  import { onMount } from "svelte"

  import type { TranslateProviderProps } from "../svelte-runtime.mjs"

  import { subscribeToLocaleValuesHotUpdates } from "../runtime/hot-locale-values.js"
  import { setMessages } from "../svelte-runtime.mjs"

  let { locale, messages, children }: TranslateProviderProps = $props()
  let sourceLocale = locale
  let sourceMessages = messages
  let resolvedMessages = $state(messages)

  $effect(() => {
    if (sourceLocale === locale && sourceMessages === messages) return
    sourceLocale = locale
    sourceMessages = messages
    resolvedMessages = messages
  })

  onMount(() =>
    subscribeToLocaleValuesHotUpdates((update) => {
      if (!locale || update.locale !== locale) return
      resolvedMessages = { ...resolvedMessages, ...update.messages }
    }),
  )

  setMessages(() => resolvedMessages)
</script>

{@render children?.()}
