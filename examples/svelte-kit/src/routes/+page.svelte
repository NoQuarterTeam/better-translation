<script lang="ts">
  import { T, Var, getT } from "better-translation/svelte"

  let { data } = $props()

  const t = getT()
  const visitor = "Maya"
  const messageCount = 4

  async function handleLocaleChange(event: Event) {
    const locale = (event.currentTarget as HTMLSelectElement).value
    const body = new FormData()
    body.set("locale", locale)

    const response = await fetch("?/setLocale", { method: "POST", body })
    if (response.ok) window.location.reload()
  }
</script>

<svelte:head>
  <title>Better Translation · SvelteKit example</title>
</svelte:head>

<main class="starter-shell">
  <header class="starter-header">
    <div class="starter-brand">
      <span class="starter-mark">B</span>
      <strong>Better Translation</strong>
    </div>
    <label class="locale-control">
      <span><T>Locale</T></span>
      <select aria-label={t("Select locale")} value={data.locale} onchange={handleLocaleChange}>
        {#each data.locales as locale}
          <option value={locale}>{locale.toUpperCase()}</option>
        {/each}
      </select>
    </label>
  </header>

  <section class="starter-content">
    <span class="framework-badge">SvelteKit + Vite</span>
    <h1><T>Good afternoon, <Var name={visitor} />.</T></h1>
    <p><T>You have <Var count={messageCount} /> Messages ready.</T></p>
    <input aria-label={t("Search Messages")} placeholder={t("Search Messages")} />
  </section>
</main>
