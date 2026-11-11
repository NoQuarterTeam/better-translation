import adapter from "@sveltejs/adapter-auto"
import { sveltekit } from "@sveltejs/kit/vite"
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite-plus"

import { betterTranslation } from "better-translation/vite"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    betterTranslation({
      locales: ["en", "nl", "es"],
      defaultLocale: "en",
      runtime: {
        type: "local",
        editor: true,
      },
    }),
    sveltekit({ adapter: adapter(), preprocess: vitePreprocess() }),
  ],
})
