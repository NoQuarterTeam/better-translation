import { defineConfig } from "vite-plus"

export default defineConfig({
  pack: {
    clean: true,
    dts: true,
    entry: {
      vite: "src/vite.ts",
      react: "src/react.tsx",
      server: "src/server.ts",
    },
    deps: {
      neverBundle: ["react", "vite"],
    },
    format: ["esm"],
    sourcemap: true,
    target: "node24",
  },
})
