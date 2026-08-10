import { createFileRoute } from "@tanstack/react-router"

import { T, Var, useT } from "better-translation/react"
import { createT } from "better-translation/runtime"

import { LocaleSwitcher } from "@/components/locale-switcher"

export const Route = createFileRoute("/")({
  component: HomePage,
  head: ({ match }) => {
    const t = createT(match.context.messages)

    return {
      meta: [
        { title: `Better Translation · ${t("Local-first i18n for Vite")}` },
        {
          name: "description",
          content: t(
            "A small, production-shaped example of Translation markers, translators, Variable placeholders, and Runtime bundle loading.",
          ),
        },
      ],
    }
  },
})

const framework = "React"
const localeCount = 3
const visitor = "Maya"
const messageCount = 4

function HomePage() {
  const t = useT()
  const { locale } = Route.useRouteContext()

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden>
            B
          </span>
          <span>Better Translation</span>
        </a>
        <div className="topbar-actions">
          <span className="framework-badge">
            <T>
              <Var framework={framework} /> example
            </T>
          </span>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="hero section-frame">
        <div className="hero-copy">
          <p className="eyebrow">
            <T>Local-first i18n for Vite</T>
          </p>
          <h1>
            <T>Translate the interface you already wrote.</T>
          </h1>
          <p className="hero-description">
            <T>
              Better Translation discovers Messages in your source, writes ordinary Locale JSON, and keeps the runtime API
              deliberately small.
            </T>
          </p>
          <p className="hero-detail">
            <T>
              Built for <Var framework={framework} />, with <Var count={localeCount} /> Locales ready to switch.
            </T>
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="https://docs.better-translation.dev">
              <T>Read the documentation</T>
            </a>
            <a className="button button-secondary" href="https://github.com/NoQuarterTeam/better-translation">
              <T>View on GitHub</T>
            </a>
          </div>
          <div className="install-line">
            <span className="terminal-prompt" aria-hidden>
              $
            </span>
            <code>npm install better-translation</code>
          </div>
        </div>

        <div className="preview-window">
          <div className="window-bar">
            <div className="window-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <span>Preview.tsx</span>
          </div>
          <div className="preview-content">
            <div className="status-line">
              <span className="status-dot" aria-hidden />
              <T>Runtime bundle loaded</T>
            </div>
            <h2>
              <T>Your next release can speak for itself.</T>
            </h2>
            <p>
              <T>
                Welcome back, <Var name={visitor} />. You have <Var count={messageCount} /> Messages ready.
              </T>
            </p>
            <div className="preview-locale">
              <span>
                <T>Current Locale</T>
              </span>
              <strong>{locale.toUpperCase()}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="api-section section-frame">
        <div className="section-heading">
          <p className="eyebrow">
            <T>A small API surface</T>
          </p>
          <h2>
            <T>Use the right marker for where the Message lives.</T>
          </h2>
          <p>
            <T>Visible content, attributes, runtime values, and loaded Locale values each have one clear path.</T>
          </p>
        </div>

        <div className="api-grid">
          <article className="api-card">
            <code className="api-name">T</code>
            <h3>
              <T>Visible content</T>
            </h3>
            <p>
              <T>Mark headings, labels, and rich content directly where they render.</T>
            </p>
            <pre>
              <code>{`<T>
  Ship <strong>confidently</strong>
</T>`}</code>
            </pre>
            <div className="rendered-example">
              <T>
                Keep <strong>structure and behavior</strong> in your source.
              </T>
            </div>
          </article>

          <article className="api-card">
            <code className="api-name">useT()</code>
            <h3>
              <T>Non-component copy</T>
            </h3>
            <p>
              <T>Use a translator for attributes, callbacks, and other non-component positions.</T>
            </p>
            <pre>
              <code>{`const t = useT()

<input aria-label={t("Search Messages")} />`}</code>
            </pre>
            <div className="field-example">
              <input aria-label={t("Search Messages")} placeholder={t("Search Messages")} />
              <button type="button">
                <T>Search</T>
              </button>
            </div>
          </article>

          <article className="api-card">
            <code className="api-name">Var</code>
            <h3>
              <T>Runtime values</T>
            </h3>
            <p>
              <T>Name dynamic values so translators can move them naturally.</T>
            </p>
            <pre>
              <code>{`<T>
  Welcome <Var name={name} />
</T>`}</code>
            </pre>
            <div className="rendered-example">
              <T>
                Hello, <Var name={visitor} />. Your preview is ready.
              </T>
            </div>
          </article>

          <article className="api-card">
            <code className="api-name">TranslateProvider</code>
            <h3>
              <T>Runtime context</T>
            </h3>
            <p>
              <T>Load one flat Runtime bundle and make it available to the component tree.</T>
            </p>
            <pre>
              <code>{`<TranslateProvider messages={messages}>
  <App />
</TranslateProvider>`}</code>
            </pre>
            <div className="runtime-flow" aria-label={t("Runtime loading flow")}>
              <code>loadMessages</code>
              <span aria-hidden>→</span>
              <code>Provider</code>
              <span aria-hidden>→</span>
              <code>UI</code>
            </div>
          </article>
        </div>
      </section>

      <section className="cta-section section-frame">
        <div>
          <p className="eyebrow">
            <T>Local by default</T>
          </p>
          <h2>
            <T>Ordinary JSON in, translated interface out.</T>
          </h2>
        </div>
        <a className="button button-primary" href="https://docs.better-translation.dev/getting-started">
          <T>Install the Vite plugin</T>
        </a>
      </section>

      <footer className="footer section-frame">
        <span>Better Translation</span>
        <span>
          <T>Built with the public Better Translation APIs.</T>
        </span>
      </footer>
    </main>
  )
}
