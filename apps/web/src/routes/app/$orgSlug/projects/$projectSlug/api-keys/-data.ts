import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { and, eq, isNull } from "drizzle-orm"
import * as z from "zod"

import { projectMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { apiKeyInsertSchema, apiKeysTable } from "@/server/db/schema"
import { createProjectApiKeyRecord, createProjectApiKeySecret } from "@/server/platform"

export const listProjectApiKeysFn = createServerFn({ method: "GET" })
  .middleware([projectMiddleware])
  .handler(async ({ context }) => listProjectApiKeys(context.project.id))

export const createProjectApiKeyFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(apiKeyInsertSchema.pick({ name: true })))
  .handler(async ({ context, data }) => {
    const { project } = context
    const secret = createProjectApiKeySecret()

    const [apiKey] = await db
      .insert(apiKeysTable)
      .values({
        projectId: project.id,
        name: data.name,
        createdById: context.user.id,
        ...createProjectApiKeyRecord(secret),
      })
      .returning({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        keyPrefix: apiKeysTable.keyPrefix,
        keyLastFour: apiKeysTable.keyLastFour,
        createdAt: apiKeysTable.createdAt,
        lastUsedAt: apiKeysTable.lastUsedAt,
        revokedAt: apiKeysTable.revokedAt,
      })

    if (!apiKey) throw new Error("Could not create API key.")

    return { apiKey, secret }
  })

export const revokeProjectApiKeyFn = createServerFn({ method: "POST" })
  .middleware([projectMiddleware])
  .inputValidator(parseZod(z.object({ apiKeyId: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    const { project } = context
    const [apiKey] = await db
      .update(apiKeysTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeysTable.id, data.apiKeyId), eq(apiKeysTable.projectId, project.id), isNull(apiKeysTable.revokedAt)))
      .returning({ id: apiKeysTable.id, revokedAt: apiKeysTable.revokedAt })

    if (!apiKey) throw new Error("Could not revoke API key.")
    return apiKey
  })

export const projectApiKeysQueryOptions = (orgSlug: string, projectSlug: string) =>
  queryOptions({
    queryKey: ["project-api-keys", orgSlug, projectSlug],
    queryFn: () => listProjectApiKeysFn({ data: { orgSlug, projectSlug } }),
  })

async function listProjectApiKeys(projectId: string) {
  return db.query.apiKeysTable.findMany({
    columns: {
      createdAt: true,
      id: true,
      keyLastFour: true,
      keyPrefix: true,
      lastUsedAt: true,
      name: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
    where: { projectId },
  })
}
