import { createFileRoute } from "@tanstack/react-router"

import { T } from "better-translation/react"
import { createTranslator } from "better-translation/server"

export const Route = createFileRoute("/app/$orgSlug/_org/users")({
  component: UsersPage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Users")} · Better Translation` }] }
  },
})

function UsersPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Users</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Manage organization members and invitations.</T>
        </p>
      </div>
    </div>
  )
}
