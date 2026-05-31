import { createFileRoute } from "@tanstack/react-router"

import { db } from "@/server/db"

const runtimeBundleCacheControl = "public, max-age=0, s-maxage=60, stale-while-revalidate=3600"

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
        const project = await db.query.projectsTable.findFirst({ where: { publicId: params.projectId } })

        if (!project) return json({ error: "Project not found" }, 404)
        if (!project.locales.includes(params.locale)) return json({ error: "Locale not found" }, 404)

        const branch = await db.query.branchesTable.findFirst({
          where: { projectId: project.id, name: params.branchName },
        })

        if (!branch) return json({ error: "Branch not found" }, 404)

        const messages = await db.query.messagesTable.findMany({
          where: { active: true, branchId: branch.id, projectId: project.id },
        })

        if (params.locale === project.defaultLocale) {
          return json(Object.fromEntries(messages.map((message) => [message.lookupId, message.defaultMessage])))
        }

        const values = await db.query.localeValuesTable.findMany({
          where: { branchId: branch.id, locale: params.locale },
        })

        return json(
          Object.fromEntries(
            messages.map((message) => {
              const branchValue = values.find((value) => value.branchId === branch.id && value.messageId === message.id)
              return [message.lookupId, branchValue?.value ?? message.defaultMessage]
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
    headers: runtimeBundleHeaders(status === 200 ? runtimeBundleCacheControl : "no-cache"),
  })
}

function runtimeBundleHeaders(cacheControl: string) {
  return {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": cacheControl,
    "cdn-cache-control": cacheControl,
    "content-type": "application/json; charset=utf-8",
    "vercel-cdn-cache-control": cacheControl,
  }
}
