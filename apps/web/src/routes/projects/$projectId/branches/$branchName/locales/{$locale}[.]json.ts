import { createFileRoute } from "@tanstack/react-router"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/server/db"
import { branchesTable, localeValuesTable, messagesTable, projectsTable } from "@/server/db/schema"

export const Route = createFileRoute("/projects/$projectId/branches/$branchName/locales/{$locale}.json")({
  server: {
    handlers: {
      OPTIONS: () => {
        return new Response(null, {
          status: 204,
          headers: runtimeBundleHeaders("no-cache"),
        })
      },
      GET: async ({ params }) => {
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.publicId, params.projectId)).limit(1)

        if (!project) return json({ error: "Project not found" }, 404)
        if (!project.locales.includes(params.locale)) return json({ error: "Locale not found" }, 404)

        const [branch] = await db
          .select()
          .from(branchesTable)
          .where(and(eq(branchesTable.projectId, project.id), eq(branchesTable.name, params.branchName)))
          .limit(1)

        if (!branch) return json({ error: "Translation Branch not found" }, 404)

        const messages = await db
          .select()
          .from(messagesTable)
          .where(and(eq(messagesTable.projectId, project.id), eq(messagesTable.active, true)))

        if (params.locale === project.defaultLocale) {
          return json(Object.fromEntries(messages.map((message) => [message.messageId, message.defaultMessage])))
        }

        const branchIds = branch.parentBranchId ? [branch.id, branch.parentBranchId] : [branch.id]
        const values = await db
          .select()
          .from(localeValuesTable)
          .where(and(inArray(localeValuesTable.branchId, branchIds), eq(localeValuesTable.locale, params.locale)))

        return json(
          Object.fromEntries(
            messages.map((message) => {
              const branchValue = values.find((value) => value.branchId === branch.id && value.messageId === message.id)
              const parentValue = values.find(
                (value) => value.branchId === branch.parentBranchId && value.messageId === message.id,
              )
              return [message.messageId, branchValue?.value ?? parentValue?.value ?? message.defaultMessage]
            }),
          ),
        )
      },
    },
  },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: runtimeBundleHeaders(status === 200 ? "public, s-maxage=60, stale-while-revalidate=600" : "no-cache"),
  })
}

function runtimeBundleHeaders(cacheControl: string) {
  return {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": cacheControl,
    "content-type": "application/json; charset=utf-8",
  }
}
