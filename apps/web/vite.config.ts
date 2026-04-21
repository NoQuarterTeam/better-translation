import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { generateText } from "ai"
import { betterTranslate, type TranslateMessage } from "better-translation/vite"
import dedent from "dedent"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    betterTranslate({
      locales: ["en", "nl"],
      defaultLocale: "en",
      storage: { type: "bundle", output: "src/lib/bt" },
      async translate(messages: TranslateMessage[], locale: string) {
        const result: Record<string, string> = {}

        for (const message of messages) {
          const messageContext = message.meta?.context
          const { text: translated } = await generateText({
            model: "openai/gpt-4.1-mini",
            system: dedent(`
              ## Task
              Translate the provided UI string to ${locale}.

              ## Product Context
              This text is for a web application UI.
              Prefer natural, concise wording that feels correct in buttons, labels, validation messages, dialogs, menus, and other interface copy.

              ${messageContext ? `## Message Context\n${messageContext}\n` : ""}

              ## Rules
              Preserve {placeholder} tokens exactly.
              Keep the meaning and tone appropriate for UI copy.
              Return only the translated string.
              Do not add quotes, labels, or explanations.
            `),
            prompt: message.text,
          })
          result[message.id] = translated.trim()
        }

        return result
      },
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
