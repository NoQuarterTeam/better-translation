import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  pack: {
    clean: true,
    dts: true,
    entry: {
      vite: "src/vite.ts",
      react: "src/react.tsx",
      server: "src/server.ts",
      ai: "src/ai.ts",
      messages: "src/messages.ts",
    },
    deps: {
      neverBundle: ["ai", "react", "react-dom", "vite"],
    },
    format: ["esm"],
    sourcemap: true,
    target: "node24",
  },
  plugins: [tailwindcss()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    copyPublicDir: false,
    cssCodeSplit: false,
    emptyOutDir: false,
    lib: {
      cssFileName: "style",
      entry: "src/local-editor/client.tsx",
      fileName: () => "local-editor.js",
      formats: ["iife"],
      name: "BetterTranslationLocalEditor",
    },
    outDir: "dist",
    rolldownOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names.includes("style.css")) return "style.css"
          return "local-editor-assets/[name]-[hash][extname]"
        },
      },
    },
    sourcemap: false,
    target: "baseline-widely-available",
  },
})
