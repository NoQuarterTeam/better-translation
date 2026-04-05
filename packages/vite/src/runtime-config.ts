import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { BetterTranslateRuntimeConfig } from "./types.js"

export const DEFAULT_LOCAL_OUTPUT_DIR = "locales"
export const LOCAL_RUNTIME_CONFIG_FILENAME = ".better-translate-runtime.json"
export const ROOT_RUNTIME_CONFIG_DIR = ".better-translate"
export const ROOT_RUNTIME_CONFIG_FILENAME = "runtime.json"

export function getLocalRuntimeConfigPath(root: string, dir: string) {
  return resolve(root, dir, LOCAL_RUNTIME_CONFIG_FILENAME)
}

export function getRootRuntimeConfigPath(root: string) {
  return resolve(root, ROOT_RUNTIME_CONFIG_DIR, ROOT_RUNTIME_CONFIG_FILENAME)
}

export function getRootRuntimeConfigCandidatePaths(importMetaUrl: string) {
  const currentDir = dirname(fileURLToPath(importMetaUrl))
  return [
    resolve(ROOT_RUNTIME_CONFIG_DIR, ROOT_RUNTIME_CONFIG_FILENAME),
    resolve(currentDir, ROOT_RUNTIME_CONFIG_DIR, ROOT_RUNTIME_CONFIG_FILENAME),
    resolve(currentDir, "..", ROOT_RUNTIME_CONFIG_DIR, ROOT_RUNTIME_CONFIG_FILENAME),
  ]
}

export function getLocalConfigCandidatePaths(dir: string, importMetaUrl: string, fileName: string) {
  const currentDir = dirname(fileURLToPath(importMetaUrl))
  return [resolve(dir, fileName), resolve(currentDir, dir, fileName), resolve(currentDir, "..", dir, fileName)]
}

export function readRuntimeConfigFromPaths(paths: string[]) {
  for (const path of dedupe(paths)) {
    if (!existsSync(path)) continue
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as BetterTranslateRuntimeConfig
    } catch {
      continue
    }
  }
  return null
}

function dedupe(paths: string[]) {
  return [...new Set(paths)]
}
