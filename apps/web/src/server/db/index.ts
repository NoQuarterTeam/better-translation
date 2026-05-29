// import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
// import { EnhancedQueryLogger } from "drizzle-query-logger"

import { relations } from "./schema/relations"

if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL")

// const sql = neon(process.env.DATABASE_URL)

export const db = drizzle({
  connection: { connectionString: process.env.DATABASE_URL },
  relations,
})
