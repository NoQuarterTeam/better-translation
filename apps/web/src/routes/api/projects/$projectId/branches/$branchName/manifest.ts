import { createFileRoute } from "@tanstack/react-router"
import { and, eq, notInArray } from "drizzle-orm"
import { start } from "workflow/api"
import * as z from "zod"

import { db } from "@/server/db"
import { apiKeysTable, branchesTable, messagesTable, projectsTable } from "@/server/db/schema"
import { createProjectApiKeyHash, createStableHash, readBearerToken } from "@/server/platform"

import { fillManifestLocaleValuesWorkflow } from "./-manifest-locale-fill"

const manifestSourceSchema = z
  .object({
    file: z.string().trim().min(1),
    kind: z.string().optional(),
    marker: z.string().optional(),
  })
  .strict()

const manifestEntrySchema = z.object({
  defaultMessage: z.string().min(1),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
  placeholders: z.array(z.string().trim().min(1)).optional().default([]),
  sources: z.array(manifestSourceSchema).optional().default([]),
})

const manifestSyncSchema = z
  .object({
    defaultLocale: z.string().trim().min(2).max(20),
    locales: z.array(z.string().trim().min(2).max(20)).min(1).max(20),
    messages: z.record(z.string().trim().min(1), manifestEntrySchema),
  })
  .transform((manifest) => {
    const defaultLocale = manifest.defaultLocale.toLowerCase()
    return {
      ...manifest,
      defaultLocale,
      locales: [...new Set([defaultLocale, ...manifest.locales.map((locale) => locale.toLowerCase())])],
    }
  })

type ManifestSync = z.infer<typeof manifestSyncSchema>
type ManifestMessages = ManifestSync["messages"]
type Message = typeof messagesTable.$inferSelect

export const Route = createFileRoute("/api/projects/$projectId/branches/$branchName/manifest")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = readBearerToken(request)
        if (!token) return json({ error: "Missing bearer token" }, 401)

        const projectAuth = await getAuthorizedProject(params.projectId, token)
        if (!projectAuth) return json({ error: "Invalid Project API key" }, 401)

        const parsed = manifestSyncSchema.safeParse(await request.json())
        if (!parsed.success) return json({ error: "Invalid Manifest payload", issues: parsed.error.issues }, 400)

        await markApiKeyUsed(projectAuth.apiKeyId)

        const branch = await upsertBranch({
          defaultLocale: parsed.data.defaultLocale,
          locales: parsed.data.locales,
          name: params.branchName,
          projectId: projectAuth.project.id,
        })
        const defaultBranchId = projectAuth.project.defaultBranchId ?? branch.id

        await updateProjectManifestState({ defaultBranchId, projectId: projectAuth.project.id })

        const messageSync = await syncBranchMessages({
          branchId: branch.id,
          messages: parsed.data.messages,
          projectId: projectAuth.project.id,
        })

        const localeFillRunId = await startLocaleFillWorkflow({
          branch,
          defaultBranchId,
          messageCount: messageSync.messages.length,
          projectId: projectAuth.project.id,
        })

        await markBranchSynced(branch.id)

        return json({
          projectId: projectAuth.project.publicId,
          branch: params.branchName,
          defaultLocale: parsed.data.defaultLocale,
          locales: parsed.data.locales,
          changed: messageSync.changed,
          localeFillQueued: localeFillRunId !== null,
          localeFillRunId,
          messageCount: messageSync.messages.length,
        })
      },
    },
  },
})

async function markApiKeyUsed(apiKeyId: string) {
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, apiKeyId))
}

async function upsertBranch({
  defaultLocale,
  locales,
  name,
  projectId,
}: {
  defaultLocale: string
  locales: string[]
  name: string
  projectId: string
}) {
  const [branch] = await db
    .insert(branchesTable)
    .values({ defaultLocale, locales, projectId, name })
    .onConflictDoUpdate({
      target: [branchesTable.projectId, branchesTable.name],
      set: { archivedAt: null, defaultLocale, locales, updatedAt: new Date() },
    })
    .returning()

  if (!branch) throw new Error("Could not create Branch.")
  return branch
}

async function updateProjectManifestState({ defaultBranchId, projectId }: { defaultBranchId: string; projectId: string }) {
  await db.update(projectsTable).set({ defaultBranchId, updatedAt: new Date() }).where(eq(projectsTable.id, projectId))
}

async function syncBranchMessages({
  branchId,
  messages,
  projectId,
}: {
  branchId: string
  messages: ManifestMessages
  projectId: string
}) {
  const existingMessages = await db.query.messagesTable.findMany({
    where: { branchId, projectId },
  })
  const existingMessageByLookupId = new Map(existingMessages.map((message) => [message.lookupId, message]))
  const syncedMessages = []
  let changed = false

  for (const [lookupId, message] of Object.entries(messages)) {
    const syncResult = await syncBranchMessage({
      branchId,
      existingMessage: existingMessageByLookupId.get(lookupId),
      lookupId,
      message,
      projectId,
    })
    if (syncResult.action !== "unchanged") changed = true
    const syncedMessage = syncResult.message
    syncedMessages.push(syncedMessage)
  }

  const deactivatedMessageCount = await deactivateMissingBranchMessages({
    branchId,
    existingMessages,
    syncedLookupIds: new Set(Object.keys(messages)),
  })

  return {
    changed: changed || deactivatedMessageCount > 0,
    messages: syncedMessages,
  }
}

async function syncBranchMessage({
  branchId,
  existingMessage,
  lookupId,
  message,
  projectId,
}: {
  branchId: string
  existingMessage: Message | undefined
  lookupId: string
  message: ManifestMessages[string]
  projectId: string
}) {
  const defaultMessageHash = createStableHash(message.defaultMessage)
  const values = {
    active: true,
    branchId,
    defaultMessage: message.defaultMessage,
    defaultMessageHash,
    lookupId,
    meta: message.meta,
    placeholders: message.placeholders,
    projectId,
    sources: message.sources,
  }

  if (!existingMessage) {
    const [syncedMessage] = await db.insert(messagesTable).values(values).returning()
    if (!syncedMessage) throw new Error(`Could not sync Message ${lookupId}.`)
    return { action: "created" as const, message: syncedMessage }
  }

  if (isSameBranchMessage(existingMessage, values)) return { action: "unchanged" as const, message: existingMessage }

  const [syncedMessage] = await db
    .update(messagesTable)
    .set({
      active: true,
      defaultMessage: message.defaultMessage,
      defaultMessageHash,
      meta: message.meta,
      placeholders: message.placeholders,
      sources: message.sources,
      updatedAt: new Date(),
    })
    .where(eq(messagesTable.id, existingMessage.id))
    .returning()

  if (!syncedMessage) throw new Error(`Could not sync Message ${lookupId}.`)
  return { action: "updated" as const, message: syncedMessage }
}

function isSameBranchMessage(
  existingMessage: Message,
  incomingMessage: Pick<
    typeof messagesTable.$inferInsert,
    "active" | "defaultMessage" | "defaultMessageHash" | "lookupId" | "meta" | "placeholders" | "sources"
  >,
) {
  return (
    existingMessage.active === incomingMessage.active &&
    existingMessage.defaultMessage === incomingMessage.defaultMessage &&
    existingMessage.defaultMessageHash === incomingMessage.defaultMessageHash &&
    existingMessage.lookupId === incomingMessage.lookupId &&
    JSON.stringify(existingMessage.meta) === JSON.stringify(incomingMessage.meta) &&
    JSON.stringify(existingMessage.placeholders) === JSON.stringify(incomingMessage.placeholders) &&
    JSON.stringify(existingMessage.sources) === JSON.stringify(incomingMessage.sources)
  )
}

async function deactivateMissingBranchMessages({
  branchId,
  existingMessages,
  syncedLookupIds,
}: {
  branchId: string
  existingMessages: Message[]
  syncedLookupIds: Set<string>
}) {
  const missingActiveMessages = existingMessages.filter((message) => message.active && !syncedLookupIds.has(message.lookupId))
  if (missingActiveMessages.length === 0) return 0

  const query = db.update(messagesTable).set({ active: false, updatedAt: new Date() })

  if (syncedLookupIds.size === 0) {
    await query.where(and(eq(messagesTable.branchId, branchId), eq(messagesTable.active, true)))
  } else {
    await query.where(
      and(
        eq(messagesTable.branchId, branchId),
        eq(messagesTable.active, true),
        notInArray(messagesTable.lookupId, [...syncedLookupIds]),
      ),
    )
  }

  return missingActiveMessages.length
}

async function markBranchSynced(branchId: string) {
  await db.update(branchesTable).set({ lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(branchesTable.id, branchId))
}

async function startLocaleFillWorkflow({
  branch,
  defaultBranchId,
  messageCount,
  projectId,
}: {
  branch: typeof branchesTable.$inferSelect
  defaultBranchId: string
  messageCount: number
  projectId: string
}) {
  if (messageCount === 0) return null
  if (branch.locales.every((locale) => locale === branch.defaultLocale)) return null

  const run = await start(fillManifestLocaleValuesWorkflow, [{ branchId: branch.id, defaultBranchId, projectId }])
  return run.runId
}

async function getAuthorizedProject(projectId: string, token: string) {
  const apiKey = await db.query.apiKeysTable.findFirst({
    columns: { id: true },
    where: {
      keyHash: createProjectApiKeyHash(token),
      project: { publicId: projectId },
      revokedAt: { isNull: true },
    },
    with: { project: true },
  })

  if (!apiKey?.project) return null

  return { apiKeyId: apiKey.id, project: apiKey.project }
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
