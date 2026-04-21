import { defineConfig } from "tsdown"

export default defineConfig({
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
})
