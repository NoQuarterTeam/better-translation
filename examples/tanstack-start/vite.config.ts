import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

import { betterTranslation } from "better-translation/vite"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    betterTranslation({
      locales: ["en", "nl", "es"],
      defaultLocale: "en",
      runtime: { type: "local" },
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
