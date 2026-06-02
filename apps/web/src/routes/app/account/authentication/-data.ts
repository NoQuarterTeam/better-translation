import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

import { authMiddleware } from "@/lib/functions/middleware"
import { db } from "@/server/db"

export const listLinkedAccountsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return db.query.accountsTable.findMany({
      where: { userId: context.user.id },
      columns: {
        id: true,
        accountId: true,
        providerId: true,
        createdAt: true,
      },
    })
  })

export const linkedAccountsQueryOptions = () =>
  queryOptions({
    queryKey: ["linked-accounts"],
    queryFn: listLinkedAccountsFn,
  })
