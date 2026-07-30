#!/usr/bin/env node

import { resolve } from "node:path"
import { resolveConfig } from "vite"

import { getBetterTranslationPluginApi } from "./vite-plugin/index.js"

const PREFIX = "\x1b[36m[better-translation]\x1b[0m"
const BOLD = "\x1b[1m"
const RESET = "\x1b[0m"

interface GenerateCliOptions {
  configFile?: string
  help: boolean
  mode?: string
  root: string
}

async function main() {
  const [command, ...args] = process.argv.slice(2)

  if (!command || command === "--help" || command === "-h") {
    printHelp()
    return
  }

  if (command !== "generate") {
    throw new Error(`${PREFIX} unknown command: ${command}`)
  }

  const options = parseGenerateOptions(args)
  if (options.help) {
    printHelp()
    return
  }

  const config = await resolveConfig(
    {
      configFile: options.configFile,
      root: options.root,
    },
    "serve",
    options.mode ?? "development",
  )

  const pluginApis = config.plugins.flatMap((plugin) => {
    const api = getBetterTranslationPluginApi(plugin)
    return api ? [api] : []
  })

  if (pluginApis.length === 0) {
    throw new Error(`${PREFIX} no betterTranslation() plugin was found in the resolved Vite config`)
  }

  for (const api of pluginApis) {
    await api.generate()
  }
}

function parseGenerateOptions(args: string[]): GenerateCliOptions {
  const options: GenerateCliOptions = { help: false, root: process.cwd() }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) continue

    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }

    if (arg === "--root") {
      options.root = resolve(readOptionValue(args, index, arg))
      index += 1
      continue
    }

    if (arg === "--config") {
      options.configFile = resolve(readOptionValue(args, index, arg))
      index += 1
      continue
    }

    if (arg === "--mode") {
      options.mode = readOptionValue(args, index, arg)
      index += 1
      continue
    }

    throw new Error(`${PREFIX} unknown generate option: ${arg}`)
  }

  return options
}

function readOptionValue(args: string[], index: number, option: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("-")) throw new Error(`${PREFIX} missing value for ${option}`)
  return value
}

function printHelp() {
  console.log(
    [
      `${BOLD}Usage:${RESET}`,
      `  better-translation generate [--root <dir>] [--config <file>] [--mode <mode>]`,
      `  bt generate [--root <dir>] [--config <file>] [--mode <mode>]`,
      "",
      `${BOLD}Commands:${RESET}`,
      "  generate  Scan the Vite project and regenerate local Runtime bundles without starting a dev server.",
    ].join("\n"),
  )
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  },
)
