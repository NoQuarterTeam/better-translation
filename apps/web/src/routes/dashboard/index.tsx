import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [{ title: "Overview · Better Translation" }],
  }),
  component: DashboardHomePage,
  loader: async () => {
    return { crumb: { label: "Dashboard", url: "/dashboard" } }
  },
})

function DashboardHomePage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Welcome back. Here is a quick snapshot of your workspace.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2"></div>
    </div>
  )
}
