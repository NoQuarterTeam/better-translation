import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import packageJson from "../package.json" with { type: "json" }
import viteConfig from "../vite.config.js"

test("uses registry-compatible production dependency specifiers", () => {
  for (const specifier of Object.values(packageJson.dependencies)) {
    expect(specifier).not.toMatch(/^(catalog|workspace):/)
  }
})

test("emits the hot Locale values module imported by the copied Svelte provider", () => {
  const entry = viteConfig.pack.entry as Record<string, string>
  const outputOptions = viteConfig.pack.outputOptions as {
    entryFileNames: (chunk: { name: string }) => string
  }
  const provider = readFileSync(new URL("../src/svelte/TranslateProvider.svelte", import.meta.url), "utf8")

  expect(provider).toContain('from "../runtime/hot-locale-values.js"')
  expect(entry["runtime/hot-locale-values"]).toBe("src/runtime/hot-locale-values.ts")
  expect(outputOptions.entryFileNames({ name: "runtime/hot-locale-values" })).toBe("[name].js")
})
