import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"

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
    sveltekit(),
  ],
})
