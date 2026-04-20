import { createFileRoute } from "@tanstack/react-router"

import { T } from "@better-translate/vite/react"

export const Route = createFileRoute("/dashboard/")({
  head: ({ match }) => ({
    meta: [
      {
        title:
          match.context.locale === "nl"
            ? "Overzicht · Better Translate"
            : match.context.locale === "fr"
              ? "Apercu · Better Translate"
              : match.context.locale === "es"
                ? "Resumen · Better Translate"
                : "Overview · Better Translate",
      },
    ],
  }),
  component: DashboardHomePage,
})

function DashboardHomePage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Overview</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Welcome back. Here is a quick snapshot of your workspace.</T>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2"></div>
    </div>
  )
}
