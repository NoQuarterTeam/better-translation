import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { Component } from "svelte"
import { compile } from "svelte/compiler"

let svelteProbe = 0
export type SvelteProbeComponent = Component<Record<string, unknown>>

export async function compileSvelteProbe(source: string) {
  return loadSvelteModule(compile(source, { generate: "server" }).js.code)
}

export async function compileSvelteFile(path: string, imports: Record<string, string> = {}) {
  let code = compile(readFileSync(path, "utf8"), { filename: path, generate: "server" }).js.code
  for (const [specifier, replacement] of Object.entries(imports)) code = code.replaceAll(specifier, replacement)
  return loadSvelteModule(code)
}

async function loadSvelteModule(compiledCode: string) {
  const code = `${compiledCode}\n// probe ${svelteProbe++}`
  const directory = mkdtempSync(resolve(import.meta.dir, ".svelte-probe-"))
  const path = resolve(directory, "probe.mjs")

  try {
    writeFileSync(path, code)
    const module = (await import(pathToFileURL(path).href)) as {
      default: SvelteProbeComponent
    }
    return module.default
  } finally {
    rmSync(directory, { recursive: true })
  }
}
