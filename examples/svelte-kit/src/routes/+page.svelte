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
  <meta name="description" content="A small example of the Better Translation runtime APIs." />
</svelte:head>

<main class="demo-shell">
  <header class="demo-header">
    <div class="demo-brand">
      <span class="demo-mark">B</span>
      <strong>Better Translation</strong>
      <span class="framework-badge">SvelteKit + Vite</span>
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

  <section class="demo-grid">
    <article class="demo-card preview-card">
      <div class="card-header">
        <span class="outline-badge"><T>Live preview</T></span>
        <h1><T>Good afternoon, <Var name={visitor} />.</T></h1>
        <p><T>You have <Var count={messageCount} /> Messages ready.</T></p>
      </div>
      <div class="preview-content">
        <label class="demo-field">
          <span><T>Search Messages</T></span>
          <input aria-label={t("Search Messages")} placeholder={t("Search Messages")} />
        </label>
        <div class="locale-status">
          <span><T>Current Locale</T></span>
          <strong>{data.locale.toUpperCase()}</strong>
        </div>
      </div>
    </article>

    <article class="demo-card code-card">
      <div class="card-header">
        <h2><T>APIs used on this page</T></h2>
        <p><T>The source stays readable and the Vite plugin discovers each Message.</T></p>
      </div>
      <div class="api-list">
        <div class="api-example">
          <div class="api-meta">
            <code>T</code>
            <span>{t("Visible translated content")}</span>
          </div>
          <pre><code>{`<T>Hello there</T>`}</code></pre>
        </div>
        <div class="api-example">
          <div class="api-meta">
            <code>getT()</code>
            <span>{t("Attributes and other strings")}</span>
          </div>
          <pre><code>{`const t = getT()
<input placeholder={t("Search Messages")} />`}</code></pre>
        </div>
        <div class="api-example">
          <div class="api-meta">
            <code>Var</code>
            <span>{t("Runtime values inside Messages")}</span>
          </div>
          <pre><code>{`<T>
  Hello <Var name={visitor} />
</T>`}</code></pre>
        </div>
      </div>
    </article>
  </section>

  <footer class="demo-footer">
    <T>Edit this page, switch Locale, and watch the Runtime bundle update.</T>
  </footer>
</main>
