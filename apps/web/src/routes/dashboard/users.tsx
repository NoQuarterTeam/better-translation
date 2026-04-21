import { createFileRoute } from "@tanstack/react-router"
import { T } from "better-translate/react"

export const Route = createFileRoute("/dashboard/users")({
  component: RouteComponent,
  loader: async () => {
    return { crumb: { label: "Users", url: "/dashboard/users" } }
  },
})

function RouteComponent() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Users</T>
        </h1>
      </div>
    </div>
  )
}
