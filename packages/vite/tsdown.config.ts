import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.ts",
  },
  deps: {
    neverBundle: ["@better-translate/core", "vite"],
  },
  format: ["esm"],
  sourcemap: true,
  target: "node24",
})
