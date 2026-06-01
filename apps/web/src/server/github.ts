import { createHmac, createSign, timingSafeEqual } from "node:crypto"
import * as z from "zod"

import { env } from "@/env"

const githubInstallationRepositoriesResponseSchema = z.object({
  repositories: z.array(
    z.object({
      default_branch: z.string().trim().min(1),
      full_name: z.string().trim().min(1),
      id: z.number().int(),
      name: z.string().trim().min(1),
      owner: z.object({ login: z.string().trim().min(1) }),
      pushed_at: z.string().nullable(),
    }),
  ),
})

const githubInstallationSchema = z.object({
  account: z.object({
    avatar_url: z.string().nullable(),
    login: z.string().trim().min(1),
    type: z.string().trim().min(1),
  }),
  id: z.number().int(),
  repository_selection: z.string().trim().min(1),
})

type GitHubSetupState = { expiresAt: number; orgSlug: string; projectSlug?: string }

export function createGitHubInstallUrl(state: GitHubSetupState) {
  if (!env.GITHUB_APP_SLUG) return null

  const signedState = signGitHubSetupState(state)
  const url = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`)
  url.searchParams.set("state", signedState)
  return url.toString()
}

export function signGitHubSetupState(state: GitHubSetupState) {
  const payload = base64UrlEncode(JSON.stringify(state))
  const signature = createHmac("sha256", env.BETTER_TRANSLATION_APP_STATE_SECRET).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyGitHubSetupState(state: string, expected: Pick<GitHubSetupState, "orgSlug" | "projectSlug">) {
  const parsed = readGitHubSetupState(state)
  if (!parsed) return false
  if (parsed.orgSlug !== expected.orgSlug) return false
  if (expected.projectSlug && parsed.projectSlug !== expected.projectSlug) return false
  return true
}

export function readGitHubSetupState(state: string) {
  const [payload, signature] = state.split(".")
  if (!payload || !signature) return false

  const expectedSignature = createHmac("sha256", env.BETTER_TRANSLATION_APP_STATE_SECRET).update(payload).digest("base64url")

  const signatureBuffer = Buffer.from(signature)
  const expectedSignatureBuffer = Buffer.from(expectedSignature)

  if (signatureBuffer.length !== expectedSignatureBuffer.length) return false
  if (!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) return false

  const parsed = parseGitHubSetupState(payload)
  if (!parsed) return false

  if (parsed.expiresAt <= Date.now()) return false
  return parsed
}

export async function listGitHubInstallationRepositories(installationId: string) {
  return fetchGitHubInstallationRepositories(installationId)
}

export async function searchGitHubInstallationRepositories({
  installationId,
  page = 1,
  perPage = 5,
  search,
}: {
  installationId: string
  page?: number
  perPage?: number
  search?: string
}) {
  const query = search?.trim().toLowerCase()
  const repositories = await fetchGitHubInstallationRepositories(installationId)
  const filteredRepositories = query
    ? repositories.filter((repository) => repository.fullName.toLowerCase().includes(query))
    : repositories
  const start = (page - 1) * perPage

  return {
    hasMore: start + perPage < filteredRepositories.length,
    page,
    repositories: filteredRepositories.slice(start, start + perPage),
    totalCount: filteredRepositories.length,
  }
}

async function fetchGitHubInstallationRepositories(installationId: string) {
  const token = await createGitHubInstallationToken(installationId)
  const repositories: z.infer<typeof githubInstallationRepositoriesResponseSchema>["repositories"] = []

  for (let page = 1; ; page++) {
    const url = new URL("https://api.github.com/installation/repositories")
    url.searchParams.set("page", String(page))
    url.searchParams.set("per_page", "100")

    const response = await fetch(url, {
      headers: githubJsonHeaders(token),
    })

    if (!response.ok) throw new Error("Could not load GitHub repositories.")

    const parsed = githubInstallationRepositoriesResponseSchema.safeParse(await response.json())
    if (!parsed.success) throw new Error("GitHub returned an invalid repositories payload.")

    repositories.push(...parsed.data.repositories)

    if (parsed.data.repositories.length < 100) break
  }

  return repositories
    .sort((a, b) => {
      const latestPush = (b.pushed_at ? Date.parse(b.pushed_at) : 0) - (a.pushed_at ? Date.parse(a.pushed_at) : 0)
      return latestPush || a.full_name.localeCompare(b.full_name)
    })
    .map((repository) => ({
      defaultBranch: repository.default_branch,
      fullName: repository.full_name,
      id: String(repository.id),
      name: repository.name,
      owner: repository.owner.login,
    }))
}

export async function getGitHubAppInstallation(installationId: string) {
  const appJwt = createGitHubAppJwt()
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: githubJsonHeaders(appJwt),
  })

  if (!response.ok) throw new Error("Could not load GitHub installation.")

  const parsed = githubInstallationSchema.safeParse(await response.json())
  if (!parsed.success) throw new Error("GitHub returned an invalid installation payload.")

  return {
    accountAvatarUrl: parsed.data.account.avatar_url,
    accountLogin: parsed.data.account.login,
    accountType: parsed.data.account.type,
    installationId: String(parsed.data.id),
    repositorySelection: parsed.data.repository_selection,
  }
}

export async function ensureGitHubInstallationRepository(params: {
  installationId: string
  repositoryId: string
  repositoryName: string
  repositoryOwner: string
}) {
  const repositories = await listGitHubInstallationRepositories(params.installationId)
  const repository = repositories.find(
    (item) =>
      item.id === params.repositoryId &&
      item.owner.toLowerCase() === params.repositoryOwner.toLowerCase() &&
      item.name.toLowerCase() === params.repositoryName.toLowerCase(),
  )

  if (!repository) throw new Error("Selected repository is not available to this GitHub App installation.")
  return repository
}

export function createGitHubWebhookSignature(body: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
}

export function verifyGitHubWebhookSignature({
  body,
  secret,
  signature,
}: {
  body: string
  secret: string
  signature: string | null
}) {
  if (!signature) return false

  const expected = createGitHubWebhookSignature(body, secret)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

async function createGitHubInstallationToken(installationId: string) {
  const appJwt = createGitHubAppJwt()
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: githubJsonHeaders(appJwt),
  })

  if (!response.ok) throw new Error("Could not create GitHub installation token.")

  const parsed = z.object({ token: z.string().trim().min(1) }).safeParse(await response.json())
  if (!parsed.success) throw new Error("GitHub returned an invalid installation token payload.")

  return parsed.data.token
}

function createGitHubAppJwt() {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are not configured.")
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = base64UrlEncode(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: env.GITHUB_APP_ID }))
  const data = `${header}.${payload}`
  const signature = createSign("RSA-SHA256").update(data).sign(env.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n"), "base64url")

  return `${data}.${signature}`
}

function githubJsonHeaders(token: string) {
  return { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" }
}

function parseGitHubSetupState(payload: string) {
  try {
    return z
      .object({
        expiresAt: z.number().int(),
        orgSlug: z.string().trim().min(1),
        projectSlug: z.string().trim().min(1).optional(),
      })
      .parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")))
  } catch {
    return null
  }
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url")
}
