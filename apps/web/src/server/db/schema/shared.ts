import { integer, timestamp } from "drizzle-orm/pg-core"

export const baseColumns = {
  id: integer("id")
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => /* @__PURE__ */ new Date()),
}
