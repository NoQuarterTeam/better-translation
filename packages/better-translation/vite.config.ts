import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  pack: {
    clean: true,
    dts: true,
    entry: {
      cli: "src/cli.ts",
      vite: "src/vite.ts",
      react: "src/react.tsx",
      runtime: "src/runtime.ts",
      svelte: "src/svelte.ts",
      "svelte-runtime": "src/svelte-runtime.ts",
      ai: "src/ai.ts",
      messages: "src/messages.ts",
    },
    deps: {
      neverBundle: ["ai", "react", "react-dom", "svelte", "vite", /\.svelte$/],
    },
    copy: [
      { from: "src/svelte/T.svelte", to: "dist/svelte" },
      { from: "src/svelte/T.svelte.d.ts", to: "dist/svelte" },
      { from: "src/svelte/TranslateProvider.svelte", to: "dist/svelte" },
      { from: "src/svelte/TranslateProvider.svelte.d.ts", to: "dist/svelte" },
      { from: "src/svelte/Var.svelte", to: "dist/svelte" },
      { from: "src/svelte/Var.svelte.d.ts", to: "dist/svelte" },
    ],
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
