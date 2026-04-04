import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import type * as z from "zod"
import type { $ZodError, $ZodIssue } from "zod/v4/core"

import { db } from "@/server/db"
import { ensureSession } from "@/server/sessions"

export class SerializedZodIssues<T extends $ZodIssue[]> extends Error {
  public readonly issues: $ZodError<T>["issues"]
  constructor(issues: T) {
    super("There are some invalid fields")
    this.issues = issues
  }
}

export function parseZod<Schema extends z.ZodSchema>(schema: Schema): (input: z.input<Schema>) => z.output<Schema> {
  return (input: z.input<Schema>) => {
    const res = schema.safeParse(input)
    if (res.success) return res.data
    throw new SerializedZodIssues(res.error.issues)
  }
}

export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await ensureSession()
  const user = await db.query.usersTable.findFirst({ where: { id: session.user.id } })

  if (!user) throw redirect({ to: "/" })

  return next({ context: { ...session, user } })
})

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user.isAdmin) throw redirect({ to: "/dashboard" })

    return next({
      context: { ...context, user: { ...context.user, isAdmin: true as const } },
    })
  })
