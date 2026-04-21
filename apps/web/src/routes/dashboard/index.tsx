import { createFileRoute } from "@tanstack/react-router"
import { T } from "better-translation/react"

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [{ title: "Overview · Better Translation" }],
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
    </div>
  )
}
