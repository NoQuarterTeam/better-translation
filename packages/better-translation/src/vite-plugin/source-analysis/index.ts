import { extname } from "node:path"

import type { SourceAnalysis, SourceMarkers } from "./types.js"

import { analyzeSvelteSourceFile } from "./svelte.js"
import { analyzeTypeScriptSourceFile } from "./typescript.js"

const TYPESCRIPT_SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"])

export type { SourceAnalysis, SourceEdit } from "./types.js"

/** Extracts messages and source edits from a framework source file. */
export function analyzeSourceFile(code: string, filename: string, markers: SourceMarkers): SourceAnalysis {
  const extension = extname(filename)
  if (extension === ".svelte") return analyzeSvelteSourceFile(code, filename, markers)
  if (TYPESCRIPT_SOURCE_EXTENSIONS.has(extension)) return analyzeTypeScriptSourceFile(code, filename, markers)
  return { parsed: false, messages: [], edits: [] }
}
