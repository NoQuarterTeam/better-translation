import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { BetterTranslateRuntimeConfig } from "./types.js"

export const DEFAULT_LOCAL_OUTPUT_DIR = "locales"
export const RUNTIME_CONFIG_FILENAME = "runtime.json"
export const COMMON_RUNTIME_CONFIG_DIRS = [DEFAULT_LOCAL_OUTPUT_DIR, `assets/${DEFAULT_LOCAL_OUTPUT_DIR}`]

export function getRuntimeConfigPath(root: string, dir: string) {
  return resolve(root, dir, RUNTIME_CONFIG_FILENAME)
}

export function getRuntimeConfigCandidatePaths(importMetaUrl: string, dirs = COMMON_RUNTIME_CONFIG_DIRS) {
  return getSearchBaseDirs(importMetaUrl).flatMap((baseDir) => dirs.map((dir) => resolve(baseDir, dir, RUNTIME_CONFIG_FILENAME)))
}

export function getLocalConfigCandidatePaths(dir: string, importMetaUrl: string, fileName: string) {
  return getSearchBaseDirs(importMetaUrl).map((baseDir) => resolve(baseDir, dir, fileName))
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

function getSearchBaseDirs(importMetaUrl: string) {
  const currentDir = dirname(fileURLToPath(importMetaUrl))
  const candidates = [...collectParentDirs(process.cwd()), ...collectParentDirs(currentDir)]
  return dedupe(candidates)
}

function collectParentDirs(startDir: string, maxDepth = 6) {
  const dirs: string[] = []
  let currentDir = startDir

  for (let i = 0; i <= maxDepth; i++) {
    dirs.push(currentDir)
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  return dirs
}
