import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
// import { EnhancedQueryLogger } from "drizzle-query-logger"

import * as schema from "./schema"
import { relations } from "./schema/relations"

if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL")

const sql = neon(process.env.DATABASE_URL)

export const db = drizzle({
  client: sql,
  schema,
  relations,
})
