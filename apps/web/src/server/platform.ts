import { init } from "@paralleldrive/cuid2"
import { createHash, createHmac } from "node:crypto"

import { env } from "@/env"

export const DEFAULT_TRANSLATION_MODEL = "openai/gpt-5.5"

const createSecretId = init({ length: 40 })

export function createStableHash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function createProjectApiKeyHash(secret: string) {
  return createHmac("sha256", env.BETTER_TRANSLATION_API_KEY_HASH_SECRET).update(secret).digest("hex")
}

export function createProjectApiKeySecret() {
  return `bt_live_${createSecretId()}`
}

export function createProjectApiKeyRecord(secret: string) {
  return {
    keyPrefix: secret.slice(0, 12),
    keyHash: createProjectApiKeyHash(secret),
    keyLastFour: secret.slice(-8),
  }
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return null
  const token = authorization.slice("Bearer ".length).trim()
  return token || null
}
