import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite-plus"

import { betterTranslation } from "better-translation/vite"

const betterTranslationEndpoint =
  process.env.BETTER_TRANSLATION_ENDPOINT ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://bt.localhost:1355")

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    betterTranslation({
      locales: ["en", "nl"],
      defaultLocale: "en",
      runtime: {
        type: "remote",
        projectId: "prj_w34UnfLNZtwr",
        endpoint: betterTranslationEndpoint,
      },
      // runtime: {
      //   type: "local",
      //   target: "module",
      //   translate: createAiTranslate({
      //     prompt:
      //       "This text is for a web application UI. Prefer natural, concise wording that feels correct in buttons, labels, validation messages, dialogs, menus, and other interface copy.",
      //   }),
      // },
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
