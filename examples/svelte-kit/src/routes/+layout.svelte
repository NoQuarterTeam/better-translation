<script lang="ts">
  import { TranslateProvider } from "better-translation/svelte"

  import "../styles.css"

  let { data, children } = $props()
</script>

<svelte:head>
  <title>Better Translation SvelteKit</title>
</svelte:head>

<TranslateProvider messages={data.messages}>
  {@render children?.()}
</TranslateProvider>

