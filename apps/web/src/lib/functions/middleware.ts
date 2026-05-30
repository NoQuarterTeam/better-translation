import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"

import { db } from "@/server/db"
import { ensureSession } from "@/server/sessions"

export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await ensureSession()
  const user = await db.query.usersTable.findFirst({ where: { id: session.user.id } })

  if (!user) throw redirect({ to: "/" })

  return next({ context: { ...session, user } })
})

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/app" })

    return next({
      context: { ...context, user: { ...context.user, isAdmin: true as const } },
    })
  })
