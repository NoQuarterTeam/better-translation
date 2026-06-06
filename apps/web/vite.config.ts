import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite-plus"

import { createAiTranslate } from "better-translation/ai"
import { betterTranslation } from "better-translation/vite"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    betterTranslation({
      locales: ["en", "nl"],
      defaultLocale: "en",
      runtime: {
        type: "local",
        translate: createAiTranslate({ prompt: "Keep it short and sweet" }),
      },
    }),
    // devtools(),
    nitro({ traceDeps: ["react", "react-dom"] }),
    tailwindcss(),
    tanstackStart({
      importProtection: { client: { files: ["**/*.server.*", "**/server/**"] } },
      router: { routeToken: "layout" },
    }),
    viteReact(),
  ],
})
