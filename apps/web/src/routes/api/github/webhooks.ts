import { createFileRoute } from "@tanstack/react-router"
import { and, eq, isNull, ne } from "drizzle-orm"
import * as z from "zod"

import { env } from "@/env"
import { db } from "@/server/db"
import { branchesTable } from "@/server/db/schema"
import { verifyGitHubWebhookSignature } from "@/server/github"

const githubRepositorySchema = z.object({
  name: z.string().trim().min(1),
  owner: z.object({
    login: z.string().trim().min(1),
  }),
})

const githubDeletePayloadSchema = z.object({
  ref: z.string().trim().min(1),
  ref_type: z.string().trim().min(1),
  repository: githubRepositorySchema,
})

export const Route = createFileRoute("/api/github/webhooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text()
        if (!env.GITHUB_WEBHOOK_SECRET) return json({ error: "GitHub webhook secret is not configured" }, 500)

        const signature = request.headers.get("x-hub-signature-256")
        if (!verifyGitHubWebhookSignature({ body, secret: env.GITHUB_WEBHOOK_SECRET, signature })) {
          return json({ error: "Invalid GitHub webhook signature" }, 401)
        }

        const event = request.headers.get("x-github-event")
        if (event === "ping") return json({ ok: true })
        if (event !== "delete") return json({ ok: true, ignored: true })

        const payload = parseJson(body)
        if (!payload) return json({ error: "Invalid JSON payload" }, 400)

        const parsed = githubDeletePayloadSchema.safeParse(payload)
        if (!parsed.success) return json({ error: "Invalid GitHub delete payload", issues: parsed.error.issues }, 400)
        if (parsed.data.ref_type !== "branch") return json({ ignored: true, ok: true })

        const archivedCount = await archiveDeletedBranch({
          branchName: parsed.data.ref,
          repositoryName: parsed.data.repository.name.toLowerCase(),
          repositoryOwner: parsed.data.repository.owner.login.toLowerCase(),
        })

        return json({ archivedCount, ok: true })
      },
    },
  },
})

async function archiveDeletedBranch({
  branchName,
  repositoryName,
  repositoryOwner,
}: {
  branchName: string
  repositoryName: string
  repositoryOwner: string
}) {
  const projects = await db.query.projectsTable.findMany({
    columns: { defaultBranchId: true, id: true },
    where: {
      githubBranchCleanupEnabled: true,
      githubRepositoryName: repositoryName,
      githubRepositoryOwner: repositoryOwner,
    },
  })

  let archivedCount = 0
  const archivedAt = new Date()

  for (const project of projects) {
    const [branch] = await db
      .update(branchesTable)
      .set({ archivedAt, updatedAt: archivedAt })
      .where(
        project.defaultBranchId
          ? and(
              eq(branchesTable.projectId, project.id),
              eq(branchesTable.name, branchName),
              ne(branchesTable.id, project.defaultBranchId),
              isNull(branchesTable.archivedAt),
            )
          : and(eq(branchesTable.projectId, project.id), eq(branchesTable.name, branchName), isNull(branchesTable.archivedAt)),
      )
      .returning({ id: branchesTable.id })

    if (branch) archivedCount += 1
  }

  return archivedCount
}

function parseJson(body: string) {
  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache",
    },
  })
}
