import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
// import { generateText } from "ai"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // i18nExtractPlugin({
    //   locales: ["en", "nl", "fr", "es"],
    //   defaultLocale: "en",
    //   scan: { roots: ["src"] },
    //   storage: { type: "local", dir: "locales" },
    //   async translate(messages, locale) {
    //     const result: Record<string, string> = {}

    //     for (const [id, text] of Object.entries(messages)) {
    //       const { text: translated } = await generateText({
    //         model: "openai/gpt-4.1-mini",
    //         system: `Translate this UI string to ${locale}. Preserve {placeholder} tokens exactly. Return only the translated string, nothing else.`,
    //         prompt: text,
    //       })
    //       result[id] = translated.trim()
    //     }

    //     return result
    //   },
    // }),
    // devtools(),
    nitro(),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        client: { files: ["**/*.server.*", "**/server/**"] },
      },
      router: { routeToken: "layout" },
    }),
    viteReact(),
  ],
})
