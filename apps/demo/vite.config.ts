import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite-plus"

import { betterTranslation } from "better-translation/vite"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    betterTranslation({
      locales: ["en", "nl"],
      defaultLocale: "en",
      runtime: {
        type: "remote",
        projectId: "prj_rdbk7ts1qriiqpz9glzm537t",
        endpoint: process.env.BETTER_TRANSLATION_ENDPOINT,
      },
    }),
    // devtools(),
    nitro(),
    tailwindcss(),
    tanstackStart({
      importProtection: { client: { files: ["**/*.server.*", "**/server/**"] } },
      router: { routeToken: "layout" },
    }),
    viteReact(),
  ],
})
