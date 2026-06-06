<script lang="ts">
  import type { TranslateProviderProps } from "../svelte-runtime.mjs"

  import { setMessages } from "../svelte-runtime.mjs"

  let { messages, children }: TranslateProviderProps = $props()

  setMessages(() => messages)
</script>

{@render children?.()}
