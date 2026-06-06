import { extname } from "node:path"

import type { SourceAnalysis, SourceMarkers } from "./extractors/types.js"

import { analyzeSvelteSourceFile } from "./extractors/svelte.js"
import { analyzeTypeScriptSourceFile } from "./extractors/typescript.js"

export type { SourceAnalysis, SourceEdit } from "./extractors/types.js"

/** Extracts messages and source edits from a framework source file. */
export function analyzeSourceFile(code: string, filename: string, markers: SourceMarkers): SourceAnalysis {
  if (extname(filename) === ".svelte") return analyzeSvelteSourceFile(code, filename, markers)
  return analyzeTypeScriptSourceFile(code, filename, markers)
}
