import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import * as z from "zod"

import { authMiddleware } from "@/lib/functions/middleware"
import { parseZod } from "@/lib/functions/zod"
import { db } from "@/server/db"
import { usersTable } from "@/server/db/schema"
import { getImageVersion, withUserAvatarUrl } from "@/server/profile-images"
import { deleteStorageObject, getUserAvatarKey, headStorageObject } from "@/server/storage"

export const getProfileFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => withUserAvatarUrl(context.user))

export const userProfileQueryOptions = () =>
  queryOptions({
    queryKey: ["user-profile"],
    queryFn: getProfileFn,
    staleTime: 30_000,
  })

export const updateProfileNameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(z.object({ name: z.string().trim().min(1) })))
  .handler(async ({ context, data }) => {
    const [user] = await db
      .update(usersTable)
      .set({ name: data.name.trim(), updatedAt: new Date() })
      .where(eq(usersTable.id, context.user.id))
      .returning()

    if (!user) throw new Error("Could not update profile")

    return withUserAvatarUrl(user)
  })

export const confirmUserAvatarUploadFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(parseZod(z.object({ sourceKey: z.string().trim().min(1).max(1024) })))
  .handler(async ({ context, data }) => {
    const sourceKey = getUserAvatarKey(context.user.id)
    if (data.sourceKey !== sourceKey) throw new Error("Profile image upload does not match this user")

    await headStorageObject(sourceKey)

    const [user] = await db
      .update(usersTable)
      .set({ image: getImageVersion(), updatedAt: new Date() })
      .where(eq(usersTable.id, context.user.id))
      .returning()

    if (!user) throw new Error("Could not update profile image")

    return withUserAvatarUrl(user)
  })

export const removeUserAvatarFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await deleteStorageObject(getUserAvatarKey(context.user.id)).catch(() => undefined)

    const [user] = await db
      .update(usersTable)
      .set({ image: null, updatedAt: new Date() })
      .where(eq(usersTable.id, context.user.id))
      .returning()

    if (!user) throw new Error("Could not remove profile image")

    return withUserAvatarUrl(user)
  })
