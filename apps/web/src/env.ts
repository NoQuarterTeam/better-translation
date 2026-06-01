import { createEnv } from "@t3-oss/env-core"
import { vercel } from "@t3-oss/env-core/presets-zod"
import { z } from "zod"

export const env = createEnv({
  extends: [vercel()],
  server: {
    DATABASE_URL: z.url(),
    BETTER_TRANSLATION_APP_STATE_SECRET: z.string().min(32),
    BETTER_TRANSLATION_API_KEY_HASH_SECRET: z.string().min(32),
    GITHUB_APP_ID: z.string().min(1).optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
    GITHUB_APP_SLUG: z.string().min(1).optional(),
    GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
    RESEND_API_KEY: z.string(),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: "VITE_",

  client: {},

  shared: {
    NODE_ENV: z.enum(["development", "production"]),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    BETTER_TRANSLATION_APP_STATE_SECRET: process.env.BETTER_TRANSLATION_APP_STATE_SECRET,
    BETTER_TRANSLATION_API_KEY_HASH_SECRET: process.env.BETTER_TRANSLATION_API_KEY_HASH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})
