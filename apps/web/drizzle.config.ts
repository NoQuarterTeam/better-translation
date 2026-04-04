import { defineConfig } from "drizzle-kit"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set when running drizzle-kit (e.g. via dotenv in your shell).")
}

export default defineConfig({
  out: "./src/server/db/migrations",
  schema: "./src/server/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
})
