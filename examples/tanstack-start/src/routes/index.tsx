import { Badge } from "@better-translation/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-translation/ui/components/card"
import { Input } from "@better-translation/ui/components/input"
import { createFileRoute } from "@tanstack/react-router"

import { T, Var, useT } from "better-translation/react"

import { LocaleSwitcher } from "@/components/locale-switcher"

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Better Translation · React example" },
      { name: "description", content: "A small example of the Better Translation runtime APIs." },
    ],
  }),
})

const visitor = "Maya"
const messageCount = 4

function HomePage() {
  const t = useT()
  const { locale } = Route.useRouteContext()

  return (
    <main className="demo-shell">
      <header className="demo-header">
        <div className="demo-brand">
          <span className="demo-mark">B</span>
          <strong>Better Translation</strong>
          <Badge variant="secondary">React + Vite</Badge>
        </div>
        <LocaleSwitcher />
      </header>

      <section className="demo-grid">
        <Card className="demo-card preview-card">
          <CardHeader>
            <Badge variant="outline">
              <T>Live preview</T>
            </Badge>
            <CardTitle>
              <h1>
                <T>
                  Good afternoon, <Var name={visitor} />.
                </T>
              </h1>
            </CardTitle>
            <CardDescription>
              <T>
                You have <Var count={messageCount} /> Messages ready.
              </T>
            </CardDescription>
          </CardHeader>
          <CardContent className="preview-content">
            <label className="demo-field">
              <span>
                <T>Search Messages</T>
              </span>
              <Input aria-label={t("Search Messages")} placeholder={t("Search Messages")} />
            </label>

            <div className="locale-status">
              <span>
                <T>Current Locale</T>
              </span>
              <Badge>{locale.toUpperCase()}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="demo-card code-card">
          <CardHeader>
            <CardTitle>
              <T>APIs used on this page</T>
            </CardTitle>
            <CardDescription>
              <T>The source stays readable and the Vite plugin discovers each Message.</T>
            </CardDescription>
          </CardHeader>
          <CardContent className="api-list">
            <ApiExample name="T" description={t("Visible translated content")}>{`<T>Hello there</T>`}</ApiExample>
            <ApiExample name="useT()" description={t("Attributes and other strings")}>{`const t = useT()
<Input placeholder={t("Search Messages")} />`}</ApiExample>
            <ApiExample name="Var" description={t("Runtime values inside Messages")}>{`<T>
  Hello <Var name={visitor} />
</T>`}</ApiExample>
          </CardContent>
        </Card>
      </section>

      <footer className="demo-footer">
        <T>Edit this page, switch Locale, and watch the Runtime bundle update.</T>
      </footer>
    </main>
  )
}

function ApiExample({ children, description, name }: { children: string; description: string; name: string }) {
  return (
    <div className="api-example">
      <div className="api-meta">
        <code>{name}</code>
        <span>{description}</span>
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  )
}
