<script lang="ts">
  import { T, Var, getT } from "better-translation/svelte"

  let { data } = $props()

  const t = getT()
  const framework = "SvelteKit"
  const localeCount = 3
  const visitor = "Maya"
  const messageCount = 4

  async function handleLocaleChange(event: Event) {
    const locale = (event.currentTarget as HTMLSelectElement).value
    const body = new FormData()
    body.set("locale", locale)

    const response = await fetch("?/setLocale", {
      method: "POST",
      body,
    })

    if (response.ok) window.location.reload()
  }
</script>

<svelte:head>
  <title>Better Translation · {t("Local-first i18n for Vite")}</title>
  <meta
    name="description"
    content={t(
      "A small, production-shaped example of Translation markers, translators, Variable placeholders, and Runtime bundle loading.",
    )}
  />
</svelte:head>

<main class="site-shell">
  <header class="topbar">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">B</span>
      <span>Better Translation</span>
    </a>
    <div class="topbar-actions">
      <span class="framework-badge">
        <T><Var {framework} /> example</T>
      </span>
      <label class="locale-control">
        <span><T>Locale</T></span>
        <select aria-label={t("Select locale")} value={data.locale} onchange={handleLocaleChange}>
          {#each data.locales as locale}
            <option value={locale}>{locale.toUpperCase()}</option>
          {/each}
        </select>
      </label>
    </div>
  </header>

  <section class="hero section-frame">
    <div class="hero-copy">
      <p class="eyebrow"><T>Local-first i18n for Vite</T></p>
      <h1><T>Translate the interface you already wrote.</T></h1>
      <p class="hero-description">
        <T>
          Better Translation discovers Messages in your source, writes ordinary Locale JSON, and keeps the runtime API
          deliberately small.
        </T>
      </p>
      <p class="hero-detail">
        <T>Built for <Var {framework} />, with <Var count={localeCount} /> Locales ready to switch.</T>
      </p>
      <div class="hero-actions">
        <a class="button button-primary" href="https://docs.better-translation.dev">
          <T>Read the documentation</T>
        </a>
        <a class="button button-secondary" href="https://github.com/NoQuarterTeam/better-translation">
          <T>View on GitHub</T>
        </a>
      </div>
      <div class="install-line">
        <span class="terminal-prompt" aria-hidden="true">$</span>
        <code>npm install better-translation</code>
      </div>
    </div>

    <div class="preview-window">
      <div class="window-bar">
        <div class="window-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span>+page.svelte</span>
      </div>
      <div class="preview-content">
        <div class="status-line">
          <span class="status-dot" aria-hidden="true"></span>
          <T>Runtime bundle loaded</T>
        </div>
        <h2><T>Your next release can speak for itself.</T></h2>
        <p>
          <T>
            Welcome back, <Var name={visitor} />. You have <Var count={messageCount} /> Messages ready.
          </T>
        </p>
        <div class="preview-locale">
          <span><T>Current Locale</T></span>
          <strong>{data.locale.toUpperCase()}</strong>
        </div>
      </div>
    </div>
  </section>

  <section class="api-section section-frame">
    <div class="section-heading">
      <p class="eyebrow"><T>A small API surface</T></p>
      <h2><T>Use the right marker for where the Message lives.</T></h2>
      <p><T>Visible content, attributes, runtime values, and loaded Locale values each have one clear path.</T></p>
    </div>

    <div class="api-grid">
      <article class="api-card">
        <code class="api-name">T</code>
        <h3><T>Visible content</T></h3>
        <p><T>Mark headings, labels, and rich content directly where they render.</T></p>
        <pre><code>{`<T>
  Ship <strong>confidently</strong>
</T>`}</code></pre>
        <div class="rendered-example">
          <T>Keep <strong>structure and behavior</strong> in your source.</T>
        </div>
      </article>

      <article class="api-card">
        <code class="api-name">getT()</code>
        <h3><T>Non-component copy</T></h3>
        <p><T>Use a translator for attributes, callbacks, and other non-component positions.</T></p>
        <pre><code>{`const t = getT()

<input aria-label={t("Search Messages")} />`}</code></pre>
        <div class="field-example">
          <input aria-label={t("Search Messages")} placeholder={t("Search Messages")} />
          <button type="button"><T>Search</T></button>
        </div>
      </article>

      <article class="api-card">
        <code class="api-name">Var</code>
        <h3><T>Runtime values</T></h3>
        <p><T>Name dynamic values so translators can move them naturally.</T></p>
        <pre><code>{`<T>
  Welcome <Var name={name} />
</T>`}</code></pre>
        <div class="rendered-example">
          <T>Hello, <Var name={visitor} />. Your preview is ready.</T>
        </div>
      </article>

      <article class="api-card">
        <code class="api-name">TranslateProvider</code>
        <h3><T>Runtime context</T></h3>
        <p><T>Load one flat Runtime bundle and make it available to the component tree.</T></p>
        <pre><code>{`<TranslateProvider messages={messages}>
  {@render children()}
</TranslateProvider>`}</code></pre>
        <div class="runtime-flow" aria-label={t("Runtime loading flow")}>
          <code>loadMessages</code>
          <span aria-hidden="true">→</span>
          <code>Provider</code>
          <span aria-hidden="true">→</span>
          <code>UI</code>
        </div>
      </article>
    </div>
  </section>

  <section class="cta-section section-frame">
    <div>
      <p class="eyebrow"><T>Local by default</T></p>
      <h2><T>Ordinary JSON in, translated interface out.</T></h2>
    </div>
    <a class="button button-primary" href="https://docs.better-translation.dev/getting-started">
      <T>Install the Vite plugin</T>
    </a>
  </section>

  <footer class="footer section-frame">
    <span>Better Translation</span>
    <span><T>Built with the public Better Translation APIs.</T></span>
  </footer>
</main>
