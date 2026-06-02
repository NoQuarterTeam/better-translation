import { handleRequest, RejectUpload, route } from "@better-upload/server"
import { createFileRoute } from "@tanstack/react-router"
import { getRequestHeaders } from "@tanstack/react-start/server"
import * as z from "zod"

import { env } from "@/env"
import { hasOrganizationAccess, type OrganizationRole } from "@/lib/auth/permissions"
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import {
  organizationLogoMaxBytes,
  organizationLogoUploadMimeTypes,
  projectIconMaxBytes,
  projectIconUploadMimeTypes,
  userAvatarMaxBytes,
  userAvatarUploadMimeTypes,
} from "@/server/profile-images"
import {
  appStorageClient,
  getOrganizationLogoKey,
  getProjectIconKey,
  getUserAvatarKey,
  imageCacheControl,
} from "@/server/storage"

const organizationLogoMetadataSchema = z.object({ organizationId: z.string().trim().min(1) })
const projectIconMetadataSchema = z.object({ projectId: z.string().trim().min(1) })
const userAvatarMetadataSchema = z.object({}).optional()

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session?.user) throw new RejectUpload("You must be signed in to upload images")

  return session.user
}

async function assertOrganizationLogoAccess(organizationId: string) {
  const user = await getSessionUser()
  const member = await db.query.membersTable.findFirst({
    where: { organizationId, userId: user.id },
    columns: { role: true },
  })

  if (!member) throw new RejectUpload("Organization not found")
  if (!hasOrganizationAccess(member.role as OrganizationRole, { permissions: { organization: ["update"] } })) {
    throw new RejectUpload("You do not have permission to update organization settings")
  }
}

async function assertProjectIconAccess(projectId: string) {
  const user = await getSessionUser()
  const project = await db.query.projectsTable.findFirst({
    where: { id: projectId },
    columns: { id: true, organizationId: true },
  })

  if (!project) throw new RejectUpload("Project not found")

  const member = await db.query.membersTable.findFirst({
    where: { organizationId: project.organizationId, userId: user.id },
    columns: { id: true },
  })

  if (!member) throw new RejectUpload("Project not found")
}

const organizationLogoRoute = route({
  maxFileSize: organizationLogoMaxBytes,
  fileTypes: organizationLogoUploadMimeTypes,
  clientMetadataSchema: organizationLogoMetadataSchema,
  onBeforeUpload: async ({ file, clientMetadata }) => {
    await assertOrganizationLogoAccess(clientMetadata.organizationId)
    const sourceKey = getOrganizationLogoKey(clientMetadata.organizationId)

    return {
      bucketName: env.S3_BUCKET_NAME,
      metadata: { organizationId: clientMetadata.organizationId, sourceKey },
      objectInfo: {
        key: sourceKey,
        cacheControl: imageCacheControl,
        metadata: {
          organizationId: clientMetadata.organizationId,
          kind: "organization-logo",
          originalName: file.name,
        },
      },
    }
  },
  onAfterSignedUrl: async ({ metadata }) => {
    return { metadata }
  },
})

const projectIconRoute = route({
  maxFileSize: projectIconMaxBytes,
  fileTypes: projectIconUploadMimeTypes,
  clientMetadataSchema: projectIconMetadataSchema,
  onBeforeUpload: async ({ file, clientMetadata }) => {
    await assertProjectIconAccess(clientMetadata.projectId)
    const sourceKey = getProjectIconKey(clientMetadata.projectId)

    return {
      bucketName: env.S3_BUCKET_NAME,
      metadata: { projectId: clientMetadata.projectId, sourceKey },
      objectInfo: {
        key: sourceKey,
        cacheControl: imageCacheControl,
        metadata: {
          projectId: clientMetadata.projectId,
          kind: "project-icon",
          originalName: file.name,
        },
      },
    }
  },
  onAfterSignedUrl: async ({ metadata }) => {
    return { metadata }
  },
})

const userAvatarRoute = route({
  maxFileSize: userAvatarMaxBytes,
  fileTypes: userAvatarUploadMimeTypes,
  clientMetadataSchema: userAvatarMetadataSchema,
  onBeforeUpload: async ({ file }) => {
    const user = await getSessionUser()
    const sourceKey = getUserAvatarKey(user.id)

    return {
      bucketName: env.S3_BUCKET_NAME,
      metadata: { sourceKey, userId: user.id },
      objectInfo: {
        key: sourceKey,
        cacheControl: imageCacheControl,
        metadata: {
          kind: "user-avatar",
          originalName: file.name,
          userId: user.id,
        },
      },
    }
  },
  onAfterSignedUrl: async ({ metadata }) => {
    return { metadata }
  },
})

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleRequest(request, {
            client: appStorageClient,
            bucketName: env.S3_BUCKET_NAME,
            routes: { organizationLogo: organizationLogoRoute, projectIcon: projectIconRoute, userAvatar: userAvatarRoute },
          })
        } catch (error) {
          console.error("Upload route failed", error)
          if (error instanceof RejectUpload) {
            return Response.json({ error: { type: "rejected", message: error.message } }, { status: 400 })
          }

          return Response.json(
            { error: { type: "unknown", message: error instanceof Error ? error.message : "Failed to prepare upload" } },
            { status: 500 },
          )
        }
      },
    },
  },
})
