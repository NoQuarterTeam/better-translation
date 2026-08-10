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
          <span className="starter-mark">B</span>
          <strong>Better Translation</strong>
        </div>
        <LocaleSwitcher />
      </header>

      <section className="starter-content">
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
      </section>
    </main>
  )
}
