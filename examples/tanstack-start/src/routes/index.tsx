import { Badge } from "@better-translation/ui/components/badge"
import { Input } from "@better-translation/ui/components/input"
import { createFileRoute } from "@tanstack/react-router"

import { T, Var, useT } from "better-translation/react"

import { LocaleSwitcher } from "@/components/locale-switcher"

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Better Translation · React example" }] }),
})

const visitor = "Maya"
const messageCount = 4

function HomePage() {
  const t = useT()

  return (
    <main className="starter-shell">
      <header className="starter-header">
        <div className="starter-brand">
          <span className="starter-mark">
            <TranslationLogo />
          </span>
          <strong>Better Translation</strong>
        </div>
        <LocaleSwitcher />
      </header>

      <section className="starter-content">
        <div className="starter-preview">
          <Badge variant="secondary">React + Vite</Badge>
          <h1>
            <T>
              Good afternoon, <Var name={visitor} />.
            </T>
          </h1>
          <p>
            <T>
              You have <Var count={messageCount} /> Messages ready.
            </T>
          </p>
          <Input aria-label={t("Search Messages")} placeholder={t("Search Messages")} />
        </div>

        <div className="code-panel">
          <div className="code-header">
            <span>src/routes/index.tsx</span>
          </div>
          <pre>
            <code>{`const t = useT()

<T>
  Good afternoon,
  <Var name={visitor} />.
</T>

<Input
  placeholder={t("Search Messages")}
/>`}</code>
          </pre>
        </div>
      </section>
    </main>
  )
}

function TranslationLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  )
}
