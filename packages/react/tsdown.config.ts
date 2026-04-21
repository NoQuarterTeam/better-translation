import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.tsx",
  },
  deps: {
    neverBundle: ["react", "@better-translate/core"],
  },
  format: ["esm"],
  sourcemap: true,
  target: "node24",
})
