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
      <span class="starter-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m5 8 6 6"></path>
          <path d="m4 14 6-6 2-3"></path>
          <path d="M2 5h12"></path>
          <path d="M7 2h1"></path>
          <path d="m22 22-5-10-5 10"></path>
          <path d="M14 18h6"></path>
        </svg>
      </span>
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
    <div class="starter-preview">
      <span class="framework-badge">SvelteKit + Vite</span>
      <h1><T>Good afternoon, <Var name={visitor} />.</T></h1>
      <p><T>You have <Var count={messageCount} /> Messages ready.</T></p>
      <input aria-label={t("Search Messages")} placeholder={t("Search Messages")} />
    </div>

    <div class="code-panel">
      <div class="code-header">src/routes/+page.svelte</div>
      <pre><code>{`const t = getT()

<T>
  Good afternoon,
  <Var name={visitor} />.
</T>

<input
  placeholder={t("Search Messages")}
/>`}</code></pre>
    </div>
  </section>
</main>
