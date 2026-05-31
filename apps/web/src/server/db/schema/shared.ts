import { createId } from "@paralleldrive/cuid2"
import { text, timestamp } from "drizzle-orm/pg-core"

export const baseColumns = {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => /* @__PURE__ */ new Date()),
}
