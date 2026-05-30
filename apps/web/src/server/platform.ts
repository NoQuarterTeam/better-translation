import { nanoid } from "nanoid"
import { createHash } from "node:crypto"

export const DEFAULT_TRANSLATION_BRANCH = "main"
export const DEFAULT_TRANSLATION_MODEL = "openai/gpt-5.5"

export function createStableHash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function createProjectPublicId() {
  return `prj_${nanoid(12)}`
}

export function createProjectApiKeySecret() {
  return `bt_live_${nanoid(40)}`
}

export function createProjectApiKeyRecord(secret: string) {
  return {
    keyPrefix: secret.slice(0, 12),
    keyHash: createStableHash(secret),
    keyLastFour: secret.slice(-4),
  }
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return null
  const token = authorization.slice("Bearer ".length).trim()
  return token || null
}
