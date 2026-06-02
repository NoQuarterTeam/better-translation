import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import mdx from "fumadocs-mdx/vite"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { tslib: "tslib/tslib.es6.mjs" } },
  plugins: [
    mdx(),
    nitro(),
    tailwindcss(),
    tanstackStart({
      importProtection: { client: { files: ["**/*.server.*", "**/server/**"] } },
      router: { routeToken: "layout" },
    }),
    viteReact(),
  ],
})
