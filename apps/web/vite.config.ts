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
      storage: { type: "bundle", output: "src/lib/bt" },
      translate: createAiTranslate({
        prompt:
          "This text is for a web application UI. Prefer natural, concise wording that feels correct in buttons, labels, validation messages, dialogs, menus, and other interface copy.",
      }),
    }),
    // devtools(),
    nitro({
      preset: "vercel",
    }),
    tailwindcss(),
    tanstackStart({
      importProtection: { client: { files: ["**/*.server.*", "**/server/**"] } },
      router: { routeToken: "layout" },
    }),
    viteReact(),
  ],
})
