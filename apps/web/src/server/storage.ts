import { aws } from "@better-upload/server/clients"
import { deleteObject, headObject, presignGetObject } from "@better-upload/server/helpers"

import { env } from "@/env"
import { imageUploadMaxBytes, imageUploadMimeTypes } from "@/lib/image-upload"

export const imageCacheControl = "private, max-age=86400, stale-while-revalidate=604800"
export const signedImageUrlExpiresIn = 60 * 60 * 24 * 7
export { imageUploadMaxBytes, imageUploadMimeTypes }

export const appStorageClient = aws({
  accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
  region: env.AWS_REGION,
})

export function getOrganizationLogoKey(organizationId: string) {
  return `organizations/${organizationId}/logo`
}

export function getProjectIconKey(projectId: string) {
  return `projects/${projectId}/icon`
}

export function getUserAvatarKey(userId: string) {
  return `users/${userId}/avatar`
}

export async function getSignedImageUrl(key: string, expiresIn = signedImageUrlExpiresIn) {
  return presignGetObject(appStorageClient, { bucket: env.S3_BUCKET_NAME, key, expiresIn })
}

export async function headStorageObject(key: string) {
  return headObject(appStorageClient, { bucket: env.S3_BUCKET_NAME, key })
}

export async function deleteStorageObject(key: string) {
  return deleteObject(appStorageClient, { bucket: env.S3_BUCKET_NAME, key })
}
