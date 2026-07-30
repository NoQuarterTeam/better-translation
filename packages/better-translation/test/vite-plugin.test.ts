import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { ResolvedConfig } from "vite"

import { createEmptyCache, loadCache } from "../src/vite-plugin/cache.js"
import { betterTranslation, getBetterTranslationPluginApi } from "../src/vite-plugin/index.js"
import { ManifestState } from "../src/vite-plugin/manifest-state.js"
import { analyzeSourceFile } from "../src/vite-plugin/source-analysis/index.js"

const testDirectories: string[] = []
let restoreLifecycleTimers: (() => void) | undefined

afterEach(() => {
  restoreLifecycleTimers?.()
  restoreLifecycleTimers = undefined
  for (const root of testDirectories.splice(0)) {
    if (existsSync(root)) rmSync(root, { recursive: true })
  }
})

function createPluginRoot() {
  const root = mkdtempSync(join(tmpdir(), "better-translation-plugin-"))
  testDirectories.push(root)
  mkdirSync(join(root, "src"), { recursive: true })
  return root
}

function resolvePlugin(
  plugin: ReturnType<typeof betterTranslation>,
  root: string,
  command: "build" | "serve" = "serve",
  publicDir = join(root, "public"),
) {
  const hooks = plugin as unknown as {
    buildStart: () => void | Promise<void>
    closeBundle: () => void | Promise<void>
    closeWatcher: () => void | Promise<void>
    configResolved: (config: ResolvedConfig) => void
    configureServer: (server: unknown) => void
    generateBundle: () => void | Promise<void>
    load: (id: string) => string | undefined
    resolveId: (id: string) => string | undefined
    transform: (code: string, id: string) => { code: string } | undefined
  }
  hooks.configResolved({
    command,
    publicDir,
    root,
  } as ResolvedConfig)
  return hooks
}

function configureWatcher(hooks: ReturnType<typeof resolvePlugin>, onHotUpdate: (update: unknown) => void = () => {}) {
  const handlers: Record<string, (file: string) => void> = {}
  hooks.configureServer({
    httpServer: null,
    middlewares: { use() {} },
    watcher: {
      add() {},
      on(event: string, handler: (file: string) => void) {
        handlers[event] = handler
      },
    },
    ws: { send: onHotUpdate },
  })
  return handlers
}

function getVirtualMessagesModule(hooks: ReturnType<typeof resolvePlugin>) {
  const id = hooks.resolveId("better-translation/messages")
  const moduleCode = id ? hooks.load(id) : undefined
  if (!moduleCode) throw new Error("Expected the plugin to load better-translation/messages")
  return moduleCode
}

function accelerateLifecycleTimers() {
  const nativeSetTimeout = globalThis.setTimeout
  const fastSetTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) =>
    nativeSetTimeout(callback, delay === 1_000 ? 0 : delay, ...args)) as typeof setTimeout
  const setTimeoutMock = spyOn(globalThis, "setTimeout").mockImplementation(fastSetTimeout)
  restoreLifecycleTimers = () => setTimeoutMock.mockRestore()
}

async function waitFor(assertion: () => void) {
  const deadline = performance.now() + 1_000
  let failure: unknown
  while (performance.now() < deadline) {
    try {
      assertion()
      return
    } catch (error) {
      failure = error
      await Bun.sleep(5)
    }
  }
  throw failure
}

async function expectRejection(operation: () => unknown, expectedMessage: string) {
  let rejection: unknown
  try {
    await Promise.resolve(operation())
  } catch (error) {
    rejection = error
  }

  if (!(rejection instanceof Error)) {
    throw new Error(`Expected operation to reject with: ${expectedMessage}`)
  }
  expect(rejection.message).toContain(expectedMessage)
}

describe("plugin state regressions", () => {
  test("caches exact source analyses and Manifest snapshots until their inputs change", () => {
    const state = new ManifestState("/repo", false)
    const source = `<T id="stable">Hello</T>`
    const firstAnalysis = state.analyze("/repo/message.tsx", source)

    expect(state.analyze("/repo/message.tsx", source)).toBe(firstAnalysis)
    expect(state.analyze("/repo/message.tsx", `<T id="stable">Changed</T>`)).not.toBe(firstAnalysis)

    state.sync("/repo/message.tsx", source)
    const firstSnapshot = state.snapshot()
    expect(state.snapshot()).toBe(firstSnapshot)

    state.sync("/repo/message.tsx", `<T id="stable">Changed</T>`)
    expect(state.snapshot()).not.toBe(firstSnapshot)
  })

  test("treats reordered equivalent file Messages as an unchanged Manifest contribution", () => {
    const file = "/repo/src/message.svelte"
    const source = `<T><B title={t("Attribute")}>Value <Var name="value" value={t("Placeholder")} /></B></T>`
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: false }), "/repo")
    const transformed = hooks.transform(source, file)
    const state = new ManifestState("/repo", false)

    expect(transformed).toBeDefined()
    expect(state.sync(file, source)).toEqual({
      manifestChanged: true,
      localeMessagesChanged: true,
    })
    const snapshot = state.snapshot()
    expect(state.sync(file, transformed!.code)).toEqual({
      manifestChanged: false,
      localeMessagesChanged: false,
    })
    expect(state.snapshot()).toBe(snapshot)
    expect(Object.values(state.manifest).find(({ defaultMessage }) => defaultMessage === "Attribute")?.meta).toEqual({})
  })

  test("keeps new and persisted cache dictionaries prototype-safe", () => {
    const root = createPluginRoot()
    const cachePath = join(root, "cache.json")
    writeFileSync(cachePath, JSON.stringify({ entries: {}, version: 1 }))

    expect(createEmptyCache().entries.constructor).toBeUndefined()
    expect(loadCache(cachePath).entries.constructor).toBeUndefined()
  })

  test("replaces a changed Message from the same source file without reporting a lookup-id collision", async () => {
    const root = createPluginRoot()
    const file = join(root, "src", "message.tsx")
    writeFileSync(file, `<T id="stable">Old</T>`)
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: false }), root)
    await hooks.buildStart()
    const watcher = configureWatcher(hooks)

    writeFileSync(file, `<T id="stable">New</T>`)
    expect(() => watcher.change!(file)).not.toThrow()
    await Bun.sleep(50)
    expect(JSON.parse(readFileSync(join(root, ".cache/better-translation/manifest.json"), "utf8"))).toMatchObject({
      stable: { defaultMessage: "New" },
    })
  })

  test("updates Manifest and Locale artifacts when only an explicit lookup id changes", async () => {
    const root = createPluginRoot()
    const sourcePath = join(root, "src/message.tsx")
    writeFileSync(sourcePath, `<T id="old">Hello</T>`)
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: false }), root)
    await hooks.buildStart()
    const watcher = configureWatcher(hooks)

    writeFileSync(sourcePath, `<T id="new">Hello</T>`)
    watcher.change!(sourcePath)
    await Bun.sleep(75)

    expect(JSON.parse(readFileSync(join(root, ".cache/better-translation/manifest.json"), "utf8"))).toEqual({
      new: expect.objectContaining({ defaultMessage: "Hello" }),
    })
    expect(JSON.parse(readFileSync(join(root, "src/lib/bt/locales/en.json"), "utf8"))).toEqual({
      new: "Hello",
    })
  })

  test("supports explicit lookup ids that match object prototype properties", async () => {
    const root = createPluginRoot()
    writeFileSync(
      join(root, "src/messages.tsx"),
      `<><T id="constructor">Constructor</T><T id="toString">String</T><T id="__proto__">Prototype</T></>`,
    )
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: false }), root)

    await hooks.buildStart()

    const manifest = JSON.parse(readFileSync(join(root, ".cache/better-translation/manifest.json"), "utf8"))
    const localeMessages = JSON.parse(readFileSync(join(root, "src/lib/bt/locales/en.json"), "utf8"))
    expect(Object.keys(manifest).sort()).toEqual(["__proto__", "constructor", "toString"])
    expect(Object.keys(localeMessages).sort()).toEqual(["__proto__", "constructor", "toString"])
    expect(localeMessages.__proto__).toBe("Prototype")
  })

  test("coalesces watcher rename events before pruning manual Locale values", async () => {
    const root = createPluginRoot()
    const oldSourcePath = join(root, "src/old.tsx")
    const newSourcePath = join(root, "src/new.tsx")
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(oldSourcePath, `<T id="stable">Hello</T>`)
    writeFileSync(join(root, "translations/locales/fr.json"), `${JSON.stringify({ stable: "Bonjour" }, null, 2)}\n`)
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", output: "translations" },
      }),
      root,
    )
    await hooks.buildStart()
    const watcher = configureWatcher(hooks)

    renameSync(oldSourcePath, newSourcePath)
    watcher.unlink!(oldSourcePath)
    watcher.add!(newSourcePath)
    await Bun.sleep(75)

    expect(JSON.parse(readFileSync(join(root, "translations/locales/fr.json"), "utf8"))).toEqual({
      stable: "Bonjour",
    })
    await hooks.closeWatcher()
  })

  test("flushes pending watcher artifact reconciliation before closing", async () => {
    const root = createPluginRoot()
    const sourcePath = join(root, "src/message.tsx")
    writeFileSync(sourcePath, `<T id="stable">Old</T>`)
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: false }), root)
    await hooks.buildStart()
    const watcher = configureWatcher(hooks)

    writeFileSync(sourcePath, `<T id="stable">New</T>`)
    watcher.change!(sourcePath)
    await hooks.closeWatcher()

    expect(JSON.parse(readFileSync(join(root, ".cache/better-translation/manifest.json"), "utf8"))).toMatchObject({
      stable: { defaultMessage: "New" },
    })
  })

  test.each([
    {
      error: "could not parse Locale values",
      input: `{"greeting":"Bonjour"`,
      label: "malformed JSON",
    },
    {
      error: "invalid Locale values",
      input: JSON.stringify({
        defaultLocale: "en",
        locale: "fr",
        messages: {
          greeting: { translation: "Bonjour" },
          retained: { translation: 42 },
        },
      }),
      label: "an invalid legacy shape",
    },
  ])("reports $label without overwriting the repo-owned Runtime bundle", async ({ error, input }) => {
    const root = createPluginRoot()
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const localePath = join(root, "translations/locales/fr.json")
    writeFileSync(localePath, input)
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", output: "translations" },
      }),
      root,
    )

    await Promise.resolve()
      .then(() => hooks.buildStart())
      .then(
        () => {
          throw new Error("Expected buildStart to reject")
        },
        (cause: unknown) => {
          expect(cause).toBeInstanceOf(Error)
          expect((cause as Error).message).toContain(error)
        },
      )
    expect(existsSync(join(root, "translations/locales/en.json"))).toBe(false)
    expect(readFileSync(localePath, "utf8")).toBe(input)
  })

  test("accepts a committed translation that intentionally matches the source without a private cache", async () => {
    const root = createPluginRoot()
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="stable">Hello</T>`)
    writeFileSync(join(root, "translations/locales/en.json"), JSON.stringify({ stable: "Hello" }))
    writeFileSync(join(root, "translations/locales/fr.json"), JSON.stringify({ stable: "Hello" }))
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          output: "translations",
          translate: async () => ({}),
        },
      }),
      root,
      "build",
    )

    expect(await hooks.buildStart()).toBeUndefined()
  })

  test("rejects a local production build when a committed Runtime bundle is missing", async () => {
    const root = createPluginRoot()
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="stable">Hello</T>`)
    writeFileSync(join(root, "translations/locales/en.json"), JSON.stringify({ stable: "Hello" }))
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", output: "translations" },
      }),
      root,
      "build",
    )

    await expectRejection(() => hooks.buildStart(), "fr: missing file at translations/locales/fr.json")
  })

  test("rejects a local production build when a Runtime bundle is missing a lookup id", async () => {
    const root = createPluginRoot()
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="stable">Hello</T>`)
    writeFileSync(join(root, "translations/locales/en.json"), JSON.stringify({ stable: "Hello" }))
    writeFileSync(join(root, "translations/locales/fr.json"), JSON.stringify({}))
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", output: "translations" },
      }),
      root,
      "build",
    )

    await expectRejection(() => hooks.buildStart(), 'fr: missing ("stable")')
  })

  test("rejects a local production build when a Runtime bundle contains an orphaned lookup id", async () => {
    const root = createPluginRoot()
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="stable">Hello</T>`)
    writeFileSync(join(root, "translations/locales/en.json"), JSON.stringify({ stable: "Hello" }))
    writeFileSync(join(root, "translations/locales/fr.json"), JSON.stringify({ orphaned: "Ancien", stable: "Bonjour" }))
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", output: "translations" },
      }),
      root,
      "build",
    )

    await expectRejection(() => hooks.buildStart(), 'fr: orphaned ("orphaned")')
  })

  test("rejects a local production build when the Default locale Runtime bundle is stale", async () => {
    const root = createPluginRoot()
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="stable">Current</T>`)
    writeFileSync(join(root, "translations/locales/en.json"), JSON.stringify({ stable: "Previous" }))
    writeFileSync(join(root, "translations/locales/fr.json"), JSON.stringify({ stable: "Actuel" }))
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", output: "translations" },
      }),
      root,
      "build",
    )

    await expectRejection(() => hooks.buildStart(), 'en: outdated default messages ("stable")')
  })

  test("rejects a local production build when a Locale value changes the Message structure", async () => {
    const root = createPluginRoot()
    mkdirSync(join(root, "translations/locales"), { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="stable">Hello <strong>friend</strong></T>`)
    writeFileSync(join(root, "translations/locales/en.json"), JSON.stringify({ stable: "Hello <0>friend</0>" }))
    writeFileSync(join(root, "translations/locales/fr.json"), JSON.stringify({ stable: "Bonjour" }))
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", output: "translations" },
      }),
      root,
      "build",
    )

    await expectRejection(() => hooks.buildStart(), 'fr: invalid placeholders or rich-text elements ("stable")')
  })

  test("keeps local production builds check-only when a translator is configured", async () => {
    const root = createPluginRoot()
    const localesDir = join(root, "translations/locales")
    mkdirSync(localesDir, { recursive: true })
    writeFileSync(join(root, "src/message.tsx"), `<T id="stable">Hello</T>`)
    const defaultRuntimeBundle = `${JSON.stringify({ stable: "Hello" }, null, 2)}\n`
    const frenchRuntimeBundle = `${JSON.stringify({ stable: "Bonjour" }, null, 2)}\n`
    writeFileSync(join(localesDir, "en.json"), defaultRuntimeBundle)
    writeFileSync(join(localesDir, "fr.json"), frenchRuntimeBundle)
    let translated = false
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          output: "translations",
          translate: async () => {
            translated = true
            return {}
          },
        },
      }),
      root,
      "build",
    )

    await hooks.buildStart()

    expect(translated).toBe(false)
    expect(readFileSync(join(localesDir, "en.json"), "utf8")).toBe(defaultRuntimeBundle)
    expect(readFileSync(join(localesDir, "fr.json"), "utf8")).toBe(frenchRuntimeBundle)
  })

  test("generates complete local artifacts immediately through the plugin lifecycle API", async () => {
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const plugin = betterTranslation({
      locales: ["en", "fr"],
      logging: false,
      runtime: {
        type: "local",
        translate: async (messages, locale) => {
          expect(locale).toBe("fr")
          return Object.fromEntries(messages.map(({ id, text }) => [id, `FR ${text}`]))
        },
      },
    })
    resolvePlugin(plugin, root)
    const api = getBetterTranslationPluginApi(plugin)
    if (!api) throw new Error("Expected the Better Translation plugin lifecycle API")

    await api.generate()

    expect(JSON.parse(readFileSync(join(root, "src/lib/bt/locales/en.json"), "utf8"))).toEqual({ greeting: "Hello" })
    expect(JSON.parse(readFileSync(join(root, "src/lib/bt/locales/fr.json"), "utf8"))).toEqual({ greeting: "FR Hello" })
    expect(JSON.parse(readFileSync(join(root, ".cache/better-translation/manifest.json"), "utf8"))).toEqual({
      greeting: {
        defaultMessage: "Hello",
        meta: {},
        placeholders: [],
        sources: [{ file: "src/message.tsx", kind: "component", marker: "T" }],
      },
    })
  })

  test("aggregates large shared-message source sets without duplicate contributions or mutable snapshots", () => {
    const state = new ManifestState("/repo", false)
    for (let index = 0; index < 2_000; index++) {
      state.sync(`/repo/source-${index}.tsx`, `<T id="shared">Hello</T>`)
    }
    const firstSnapshot = state.snapshot()

    expect(state.manifest.shared?.sources).toHaveLength(2_000)
    state.sync("/repo/source-1000.tsx", `<T id="shared">Hello</T>`)
    state.sync("/repo/last.tsx", `<T id="shared">Hello</T>`)
    expect(state.manifest.shared?.sources).toHaveLength(2_001)
    expect(firstSnapshot.shared?.sources).toHaveLength(2_000)
    state.remove("/repo/source-1000.tsx")
    expect(state.manifest.shared?.sources).toHaveLength(2_000)
  })

  test("rejects an empty, duplicate, or incomplete Locale configuration", () => {
    const root = createPluginRoot()

    expect(() => resolvePlugin(betterTranslation({ locales: [], logging: false }), root)).toThrow("at least one Locale")
    expect(() => resolvePlugin(betterTranslation({ locales: ["en", "en"], logging: false }), root)).toThrow("duplicate Locale")
    expect(() => resolvePlugin(betterTranslation({ defaultLocale: "en", locales: ["fr"], logging: false }), root)).toThrow(
      'Default locale "en" must be included',
    )
  })

  test("scans only supported source extensions", async () => {
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="included">Included</T>`)
    writeFileSync(join(root, "src/notes.md"), `t("This is code-shaped prose", { id: "ignored" })`)
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: false }), root)

    await hooks.buildStart()

    expect(JSON.parse(readFileSync(join(root, ".cache/better-translation/manifest.json"), "utf8"))).toEqual({
      included: expect.objectContaining({ defaultMessage: "Included" }),
    })
  })

  test("applies a large edit set with output equivalent to descending source splices", () => {
    const root = createPluginRoot()
    const file = join(root, "src/messages.ts")
    const code = Array.from({ length: 500 }, (_, index) => `const message${index} = t("Message ${index}")`).join("\n")
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: false }), root)
    const analysis = analyzeSourceFile(code, file, {
      call: ["t", "useT"],
      component: ["T"],
      logging: false,
    })

    expect(hooks.transform(code, file)?.code).toBe(
      [...analysis.edits]
        .sort((a, b) => b.start - a.start)
        .reduce(
          (transformed, edit) => `${transformed.slice(0, edit.start)}${edit.replacement}${transformed.slice(edit.end)}`,
          code,
        ),
    )
  })

  test("surfaces each structured source diagnostic once when logging is enabled", async () => {
    const root = createPluginRoot()
    const file = join(root, "src/message.tsx")
    const code = `<T id={dynamic}>Hello</T>`
    writeFileSync(file, code)
    const warnings = spyOn(console, "warn").mockImplementation(() => {})
    const hooks = resolvePlugin(betterTranslation({ locales: ["en"], logging: true }), root)

    try {
      await hooks.buildStart()
      hooks.transform(code, file)

      expect(warnings).toHaveBeenCalledTimes(1)
      expect(warnings).toHaveBeenCalledWith(expect.stringContaining("requires a static string id"))
    } finally {
      warnings.mockRestore()
    }
  })

  test("recovers from an invalid cache and prunes entries outside the current Manifest and Locales", async () => {
    const invalidRoot = createPluginRoot()
    mkdirSync(join(invalidRoot, ".cache/better-translation"), { recursive: true })
    writeFileSync(join(invalidRoot, ".cache/better-translation/cache.json"), `{"version":1}`)
    writeFileSync(join(invalidRoot, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const invalidHooks = resolvePlugin(betterTranslation({ locales: ["en", "fr"], logging: false }), invalidRoot)

    expect(await invalidHooks.buildStart()).toBeUndefined()
    await invalidHooks.closeBundle()
    expect(JSON.parse(readFileSync(join(invalidRoot, ".cache/better-translation/cache.json"), "utf8"))).toEqual({
      entries: {},
      version: 1,
    })

    const staleRoot = createPluginRoot()
    mkdirSync(join(staleRoot, ".cache/better-translation"), { recursive: true })
    writeFileSync(
      join(staleRoot, ".cache/better-translation/cache.json"),
      JSON.stringify({
        entries: {
          "removed\u0000fr": {
            locale: "fr",
            meta: {},
            sourceText: "Removed",
            timestamp: 1,
            translation: "Supprimé",
          },
          "stable\u0000de": {
            locale: "de",
            meta: {},
            sourceText: "Hello",
            timestamp: 1,
            translation: "Hallo",
          },
          "stable\u0000fr": {
            locale: "fr",
            meta: {},
            sourceText: "Hello",
            timestamp: 1,
            translation: "Bonjour",
          },
        },
        version: 1,
      }),
    )
    writeFileSync(join(staleRoot, "src/message.tsx"), `<T id="stable">Hello</T>`)
    const staleHooks = resolvePlugin(betterTranslation({ locales: ["en", "fr"], logging: false }), staleRoot)

    await staleHooks.buildStart()
    await staleHooks.closeBundle()
    expect(JSON.parse(readFileSync(join(staleRoot, ".cache/better-translation/cache.json"), "utf8")).entries).toEqual({
      "stable\u0000fr": expect.objectContaining({ translation: "Bonjour" }),
    })
  })

  test("translates and persists missing Messages in plugin-sized batches", async () => {
    accelerateLifecycleTimers()
    const root = createPluginRoot()
    writeFileSync(
      join(root, "src/messages.tsx"),
      `<>${Array.from({ length: 5 }, (_, index) => `<T id="message-${index}">Message ${index}</T>`).join("\n")}</>`,
    )
    const batches: string[][] = []
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          translate: async (messages) => {
            batches.push(messages.map(({ id }) => id))
            return Object.fromEntries(messages.map(({ id, text }) => [id, `FR ${text}`]))
          },
          translationBatchSize: 2,
        },
      }),
      root,
    )

    await hooks.buildStart()
    await waitFor(() => expect(batches).toHaveLength(3))

    expect(batches).toEqual([["message-0", "message-1"], ["message-2", "message-3"], ["message-4"]])
    expect(JSON.parse(readFileSync(join(root, "src/lib/bt/locales/fr.json"), "utf8"))).toEqual({
      "message-0": "FR Message 0",
      "message-1": "FR Message 1",
      "message-2": "FR Message 2",
      "message-3": "FR Message 3",
      "message-4": "FR Message 4",
    })
  })

  test("notifies dev clients after each translated Locale batch is persisted", async () => {
    accelerateLifecycleTimers()
    const root = createPluginRoot()
    writeFileSync(join(root, "src/messages.tsx"), `<><T id="first">First</T><T id="second">Second</T><T id="third">Third</T></>`)
    const updates: Array<{ persisted: Record<string, string>; update: unknown }> = []
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          translate: async (messages) => Object.fromEntries(messages.map(({ id, text }) => [id, `FR ${text}`])),
          translationBatchSize: 2,
        },
      }),
      root,
    )
    configureWatcher(hooks, (update) => {
      updates.push({
        persisted: JSON.parse(readFileSync(join(root, "src/lib/bt/locales/fr.json"), "utf8")) as Record<string, string>,
        update,
      })
    })

    await hooks.buildStart()
    await waitFor(() => expect(updates).toHaveLength(2))

    expect(updates).toEqual([
      {
        persisted: {
          first: "FR First",
          second: "FR Second",
          third: "Third",
        },
        update: {
          data: {
            locale: "fr",
            messages: {
              first: "FR First",
              second: "FR Second",
            },
          },
          event: "better-translation:locale-values",
          type: "custom",
        },
      },
      {
        persisted: {
          first: "FR First",
          second: "FR Second",
          third: "FR Third",
        },
        update: {
          data: {
            locale: "fr",
            messages: {
              third: "FR Third",
            },
          },
          event: "better-translation:locale-values",
          type: "custom",
        },
      },
    ])
  })

  test("bridges translated Locale updates from Vite into the browser runtime", async () => {
    const root = createPluginRoot()
    const hooks = resolvePlugin(betterTranslation({ locales: ["en", "fr"], logging: false }), root)
    const moduleCode = getVirtualMessagesModule(hooks)

    let receiveUpdate!: (update: unknown) => void
    const dispatched: Array<{ detail: unknown; type: string }> = []
    const globals = globalThis as typeof globalThis & {
      __betterTranslationCustomEvent?: new (
        type: string,
        init: { detail: unknown },
      ) => {
        detail: unknown
        type: string
      }
      __betterTranslationHot?: {
        on: (event: string, listener: (update: unknown) => void) => void
      }
      __betterTranslationWindow?: {
        dispatchEvent: (event: { detail: unknown; type: string }) => void
      }
    }
    const executableCode = moduleCode
      .replaceAll("import.meta.hot", "globalThis.__betterTranslationHot")
      .replaceAll("typeof window", "typeof globalThis.__betterTranslationWindow")
      .replaceAll("window.dispatchEvent", "globalThis.__betterTranslationWindow.dispatchEvent")
      .replaceAll("new CustomEvent", "new globalThis.__betterTranslationCustomEvent")

    globals.__betterTranslationHot = {
      on(event, listener) {
        expect(event).toBe("better-translation:locale-values")
        receiveUpdate = listener
      },
    }
    globals.__betterTranslationWindow = {
      dispatchEvent(event) {
        dispatched.push(event)
      },
    }
    globals.__betterTranslationCustomEvent = class {
      detail: unknown
      type: string

      constructor(type: string, init: { detail: unknown }) {
        this.detail = init.detail
        this.type = type
      }
    }

    try {
      const modulePath = join(root, "messages.mjs")
      writeFileSync(modulePath, executableCode)
      await import(pathToFileURL(modulePath).href)

      const update = { locale: "fr", messages: { greeting: "Bonjour" } }
      receiveUpdate(update)

      expect(dispatched).toEqual([
        {
          detail: update,
          type: "better-translation:locale-values",
        },
      ])
    } finally {
      delete globals.__betterTranslationCustomEvent
      delete globals.__betterTranslationHot
      delete globals.__betterTranslationWindow
    }
  })

  test("reports a dev translation failure without leaking an unhandled rejection", async () => {
    accelerateLifecycleTimers()
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const errors = spyOn(console, "error").mockImplementation(() => {})
    const hotUpdates: unknown[] = []
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          translate: async () => {
            throw new Error("translator unavailable")
          },
        },
      }),
      root,
    )
    configureWatcher(hooks, (update) => hotUpdates.push(update))

    try {
      await hooks.buildStart()
      await waitFor(() => expect(errors).toHaveBeenCalledWith(expect.stringContaining("translator unavailable")))
      expect(errors).toHaveBeenCalledWith(expect.stringContaining("translator unavailable"))
      expect(hotUpdates).toEqual([])
    } finally {
      errors.mockRestore()
    }
  })
})

describe("plugin-generated Runtime bundle loaders", () => {
  test("generates a production module loader for every configured Locale", () => {
    const root = createPluginRoot()
    const hooks = resolvePlugin(betterTranslation({ locales: ["en", "fr"], logging: false }), root, "build")

    expect(getVirtualMessagesModule(hooks)).toBe(`export const locales = ["en","fr"]

export async function loadMessages(locale) {
  switch (locale) {
    case "en":
      return (await import("/src/lib/bt/locales/en.json")).default
    case "fr":
      return (await import("/src/lib/bt/locales/fr.json")).default
    default:
      throw new Error(\`Unknown locale: \${locale}\`)
  }
}
`)
  })

  test("rejects the public target when Vite publicDir is disabled", () => {
    const root = createPluginRoot()

    expect(() =>
      resolvePlugin(
        betterTranslation({
          locales: ["en"],
          logging: false,
          runtime: { type: "local", target: "public" },
        }),
        root,
        "serve",
        "",
      ),
    ).toThrow('runtime target "public" requires Vite publicDir to be enabled')
  })

  test("requires an explicit public base path when output is outside Vite publicDir", () => {
    const root = createPluginRoot()

    expect(() =>
      resolvePlugin(
        betterTranslation({
          locales: ["en"],
          logging: false,
          runtime: { output: "translations", target: "public", type: "local" },
        }),
        root,
      ),
    ).toThrow('runtime target "public" output must be inside Vite publicDir unless basePath is provided')
  })

  test("uses an explicit base path for a custom public Runtime bundle output", () => {
    const root = createPluginRoot()
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en"],
        logging: false,
        runtime: {
          basePath: "/assets/messages/",
          output: "translations",
          target: "public",
          type: "local",
        },
      }),
      root,
      "build",
    )

    expect(getVirtualMessagesModule(hooks)).toContain(
      "const response = await fetch(`/assets/messages/locales/${encodeURIComponent(locale)}.json`)",
    )
  })

  test("loads public Runtime bundles from the inferred Vite public path", async () => {
    const root = createPluginRoot()
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", target: "public" },
      }),
      root,
    )
    const modulePath = join(root, "public-loader.mjs")
    writeFileSync(modulePath, getVirtualMessagesModule(hooks))
    const originalFetch = globalThis.fetch
    const requests: Array<string | URL | Request> = []
    globalThis.fetch = (async (input) => {
      requests.push(input)
      return Response.json({ greeting: "Bonjour" })
    }) as typeof fetch

    try {
      const runtime = (await import(pathToFileURL(modulePath).href)) as {
        loadMessages: (locale: string) => Promise<Record<string, string>>
      }

      expect(await runtime.loadMessages("fr")).toEqual({ greeting: "Bonjour" })
      expect(requests).toEqual(["/bt/locales/fr.json"])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("rejects an unknown Locale before requesting a public Runtime bundle", async () => {
    const root = createPluginRoot()
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", target: "public" },
      }),
      root,
    )
    const modulePath = join(root, "public-unknown-locale-loader.mjs")
    writeFileSync(modulePath, getVirtualMessagesModule(hooks))
    const originalFetch = globalThis.fetch
    let requested = false
    globalThis.fetch = (async (_input, _init) => {
      requested = true
      return Response.json({})
    }) as typeof fetch

    try {
      const runtime = (await import(pathToFileURL(modulePath).href)) as {
        loadMessages: (locale: string) => Promise<Record<string, string>>
      }

      await expectRejection(() => runtime.loadMessages("de"), "Unknown locale: de")
      expect(requested).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("rejects a failed public Runtime bundle response", async () => {
    const root = createPluginRoot()
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: { type: "local", target: "public" },
      }),
      root,
    )
    const modulePath = join(root, "public-failed-response-loader.mjs")
    writeFileSync(modulePath, getVirtualMessagesModule(hooks))
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input, _init) => new Response(null, { status: 503 })) as typeof fetch

    try {
      const runtime = (await import(pathToFileURL(modulePath).href)) as {
        loadMessages: (locale: string) => Promise<Record<string, string>>
      }

      await expectRejection(() => runtime.loadMessages("fr"), "Failed to load locale: fr")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("loads a branch-addressed remote Runtime bundle without exposing the Project API key", async () => {
    const root = createPluginRoot()
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          apiKey: "project-secret",
          branch: "feature/copy",
          endpoint: "https://platform.example/",
          projectId: "project id",
          type: "remote",
        },
      }),
      root,
      "build",
    )
    const moduleCode = getVirtualMessagesModule(hooks)
    expect(moduleCode).not.toContain("project-secret")
    const modulePath = join(root, "remote-loader.mjs")
    writeFileSync(modulePath, moduleCode)
    const originalFetch = globalThis.fetch
    const requests: Array<string | URL | Request> = []
    globalThis.fetch = (async (input) => {
      requests.push(input)
      return Response.json({ greeting: "Bonjour" })
    }) as typeof fetch

    try {
      const runtime = (await import(pathToFileURL(modulePath).href)) as {
        loadMessages: (locale: string) => Promise<Record<string, string>>
      }

      expect(await runtime.loadMessages("fr")).toEqual({ greeting: "Bonjour" })
      expect(requests).toEqual(["https://platform.example/projects/project%20id/branches/feature%2Fcopy/locales/fr.json"])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("generates ignored local fallback bundles for offline remote development", async () => {
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          branch: "feature/copy",
          dev: { offline: true },
          projectId: "project",
          type: "remote",
        },
      }),
      root,
    )

    await hooks.buildStart()

    expect(JSON.parse(readFileSync(join(root, ".cache/better-translation/runtime/locales/en.json"), "utf8"))).toEqual({
      greeting: "Hello",
    })
    expect(JSON.parse(readFileSync(join(root, ".cache/better-translation/runtime/locales/fr.json"), "utf8"))).toEqual({
      greeting: "Hello",
    })
    expect(getVirtualMessagesModule(hooks)).toContain(
      'return (await import("/.cache/better-translation/runtime/locales/fr.json")).default',
    )
  })

  test("prefers the Better Translation Branch environment override for remote loaders", () => {
    const root = createPluginRoot()
    const originalBranch = process.env.BETTER_TRANSLATION_BRANCH
    const originalProviderBranch = process.env.VERCEL_GIT_COMMIT_REF
    process.env.BETTER_TRANSLATION_BRANCH = "feature/better-translation"
    process.env.VERCEL_GIT_COMMIT_REF = "feature/provider"

    try {
      const hooks = resolvePlugin(
        betterTranslation({
          locales: ["en"],
          logging: false,
          runtime: {
            branch: "auto",
            endpoint: "https://platform.example",
            projectId: "project",
            type: "remote",
          },
        }),
        root,
        "build",
      )

      expect(getVirtualMessagesModule(hooks)).toContain("/branches/feature%2Fbetter-translation/locales/")
    } finally {
      if (originalBranch === undefined) delete process.env.BETTER_TRANSLATION_BRANCH
      else process.env.BETTER_TRANSLATION_BRANCH = originalBranch
      if (originalProviderBranch === undefined) delete process.env.VERCEL_GIT_COMMIT_REF
      else process.env.VERCEL_GIT_COMMIT_REF = originalProviderBranch
    }
  })

  test("uses the provider Branch when no Better Translation override is configured", () => {
    const root = createPluginRoot()
    const originalBranch = process.env.BETTER_TRANSLATION_BRANCH
    const originalProviderBranch = process.env.VERCEL_GIT_COMMIT_REF
    delete process.env.BETTER_TRANSLATION_BRANCH
    process.env.VERCEL_GIT_COMMIT_REF = "preview/copy"

    try {
      const hooks = resolvePlugin(
        betterTranslation({
          locales: ["en"],
          logging: false,
          runtime: {
            branch: "auto",
            endpoint: "https://platform.example",
            projectId: "project",
            type: "remote",
          },
        }),
        root,
        "build",
      )

      expect(getVirtualMessagesModule(hooks)).toContain("/branches/preview%2Fcopy/locales/")
    } finally {
      if (originalBranch === undefined) delete process.env.BETTER_TRANSLATION_BRANCH
      else process.env.BETTER_TRANSLATION_BRANCH = originalBranch
      if (originalProviderBranch === undefined) delete process.env.VERCEL_GIT_COMMIT_REF
      else process.env.VERCEL_GIT_COMMIT_REF = originalProviderBranch
    }
  })

  test("falls back to the package Branch when no environment or Git Branch is available", () => {
    const root = createPluginRoot()
    const originalBranch = process.env.BETTER_TRANSLATION_BRANCH
    const originalProviderBranch = process.env.VERCEL_GIT_COMMIT_REF
    delete process.env.BETTER_TRANSLATION_BRANCH
    delete process.env.VERCEL_GIT_COMMIT_REF

    try {
      const hooks = resolvePlugin(
        betterTranslation({
          locales: ["en"],
          logging: false,
          runtime: {
            branch: "auto",
            endpoint: "https://platform.example",
            projectId: "project",
            type: "remote",
          },
        }),
        root,
        "build",
      )

      expect(getVirtualMessagesModule(hooks)).toContain("/branches/main/locales/")
    } finally {
      if (originalBranch === undefined) delete process.env.BETTER_TRANSLATION_BRANCH
      else process.env.BETTER_TRANSLATION_BRANCH = originalBranch
      if (originalProviderBranch === undefined) delete process.env.VERCEL_GIT_COMMIT_REF
      else process.env.VERCEL_GIT_COMMIT_REF = originalProviderBranch
    }
  })
})

describe("plugin-side remote Manifest sync", () => {
  test("requires a Project API key before a remote production sync", async () => {
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const originalApiKey = process.env.BETTER_TRANSLATION_API_KEY
    delete process.env.BETTER_TRANSLATION_API_KEY
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          branch: "main",
          endpoint: "https://platform.example",
          projectId: "project",
          type: "remote",
        },
      }),
      root,
      "build",
    )

    try {
      await hooks.buildStart()
      await expectRejection(
        () => hooks.generateBundle(),
        "remote Manifest sync requires a Project API key\nset BETTER_TRANSLATION_API_KEY",
      )
    } finally {
      if (originalApiKey === undefined) delete process.env.BETTER_TRANSLATION_API_KEY
      else process.env.BETTER_TRANSLATION_API_KEY = originalApiKey
    }
  })

  test("syncs the current Manifest to the configured Project and Branch", async () => {
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const originalFetch = globalThis.fetch
    const originalApiKey = process.env.BETTER_TRANSLATION_API_KEY
    process.env.BETTER_TRANSLATION_API_KEY = "environment-secret"
    const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = []
    globalThis.fetch = (async (input, init) => {
      requests.push({ input, init })
      return Response.json({ changed: false })
    }) as typeof fetch
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          apiKey: "explicit-secret",
          branch: "feature/copy",
          endpoint: "https://platform.example/",
          projectId: "project id",
          type: "remote",
        },
      }),
      root,
      "build",
    )

    try {
      await hooks.buildStart()
      await hooks.generateBundle()

      expect(requests).toEqual([
        {
          input: "https://platform.example/api/projects/project%20id/branches/feature%2Fcopy/manifest",
          init: {
            body: JSON.stringify({
              defaultLocale: "en",
              locales: ["en", "fr"],
              messages: {
                greeting: {
                  defaultMessage: "Hello",
                  meta: {},
                  placeholders: [],
                  sources: [{ file: "src/message.tsx", kind: "component", marker: "T" }],
                },
              },
            }),
            headers: {
              authorization: "Bearer explicit-secret",
              "content-type": "application/json",
            },
            method: "POST",
          },
        },
      ])
    } finally {
      globalThis.fetch = originalFetch
      if (originalApiKey === undefined) delete process.env.BETTER_TRANSLATION_API_KEY
      else process.env.BETTER_TRANSLATION_API_KEY = originalApiKey
    }
  })

  test("reports the remote Manifest target when the hosted service cannot be reached", async () => {
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input, _init): Promise<Response> => {
      throw new TypeError("connection refused")
    }) as typeof fetch
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en"],
        logging: false,
        runtime: {
          apiKey: "secret",
          branch: "main",
          endpoint: "https://platform.example",
          projectId: "project",
          type: "remote",
        },
      }),
      root,
      "build",
    )

    try {
      await hooks.buildStart()
      await expectRejection(
        () => hooks.generateBundle(),
        [
          "remote Manifest sync could not reach the hosted service",
          "target: https://platform.example/api/projects/project/branches/main/manifest",
          "error: connection refused",
        ].join("\n"),
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("reports the hosted response when a remote Manifest sync is rejected", async () => {
    const root = createPluginRoot()
    writeFileSync(join(root, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input, _init) =>
      new Response(`{\n  "error": "Invalid Project API key"\n}`, {
        status: 401,
        statusText: "Unauthorized",
      })) as typeof fetch
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en"],
        logging: false,
        runtime: {
          apiKey: "secret",
          branch: "main",
          endpoint: "https://platform.example",
          projectId: "project",
          type: "remote",
        },
      }),
      root,
      "build",
    )

    try {
      await hooks.buildStart()
      await expectRejection(
        () => hooks.generateBundle(),
        [
          "remote Manifest sync failed with 401 Unauthorized",
          "target: https://platform.example/api/projects/project/branches/main/manifest",
          'response: { "error": "Invalid Project API key" }',
        ].join("\n"),
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("logs changed remote syncs and keeps successful no-op syncs quiet", async () => {
    const root = createPluginRoot()
    const sourcePath = join(root, "src/message.tsx")
    writeFileSync(sourcePath, `<T id="greeting">Hello</T>`)
    const originalFetch = globalThis.fetch
    const responses = [false, true]
    globalThis.fetch = (async (_input, _init) => Response.json({ changed: responses.shift() })) as typeof fetch
    const logs = spyOn(console, "log").mockImplementation(() => {})
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en"],
        runtime: {
          apiKey: "secret",
          branch: "main",
          endpoint: "https://platform.example",
          projectId: "project",
          type: "remote",
        },
      }),
      root,
      "build",
    )

    try {
      await hooks.buildStart()
      await hooks.generateBundle()
      writeFileSync(sourcePath, `<T id="greeting">Updated</T>`)
      await hooks.buildStart()
      await hooks.generateBundle()

      expect(logs.mock.calls.flat().filter((value) => String(value).includes("Synced"))).toHaveLength(1)
    } finally {
      logs.mockRestore()
      globalThis.fetch = originalFetch
    }
  })
})

describe("plugin lifecycle serialization", () => {
  test("cancels pending work and waits for in-flight work when the dev watcher closes", async () => {
    accelerateLifecycleTimers()
    const pendingRoot = createPluginRoot()
    writeFileSync(join(pendingRoot, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    let pendingCalls = 0
    const pendingHooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          translate: async () => {
            pendingCalls += 1
            return {}
          },
        },
      }),
      pendingRoot,
    )

    await pendingHooks.buildStart()
    await pendingHooks.closeWatcher()
    await Bun.sleep(10)
    expect(pendingCalls).toBe(0)

    const activeRoot = createPluginRoot()
    writeFileSync(join(activeRoot, "src/message.tsx"), `<T id="greeting">Hello</T>`)
    let release!: () => void
    const blocked = new Promise<void>((resolveBlocked) => {
      release = resolveBlocked
    })
    let activeCalls = 0
    const activeHooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          translate: async () => {
            activeCalls += 1
            await blocked
            return { greeting: "Bonjour" }
          },
        },
      }),
      activeRoot,
    )
    await activeHooks.buildStart()
    await waitFor(() => expect(activeCalls).toBe(1))
    let closed = false
    const closing = Promise.resolve(activeHooks.closeWatcher()).then(() => {
      closed = true
    })
    await Bun.sleep(10)
    expect(closed).toBe(false)

    release()
    await closing
    expect(closed).toBe(true)
  })

  test("serializes local translation and reruns against the latest Manifest", async () => {
    accelerateLifecycleTimers()
    const root = createPluginRoot()
    const file = join(root, "src/message.tsx")
    writeFileSync(file, `<T id="first">First</T>`)
    let releaseFirst!: (messages: Record<string, string>) => void
    const firstResult = new Promise<Record<string, string>>((resolveResult) => {
      releaseFirst = resolveResult
    })
    const calls: string[][] = []
    let active = 0
    let maximumActive = 0
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          translate: async (messages) => {
            calls.push(messages.map(({ id }) => id))
            active += 1
            maximumActive = Math.max(maximumActive, active)
            const result =
              calls.length === 1 ? await firstResult : Object.fromEntries(messages.map(({ id, text }) => [id, `FR ${text}`]))
            active -= 1
            return result
          },
        },
      }),
      root,
    )
    await hooks.buildStart()
    const watcher = configureWatcher(hooks)
    await waitFor(() => expect(calls).toHaveLength(1))

    writeFileSync(file, `<><T id="first">First</T><T id="second">Second</T></>`)
    watcher.change!(file)
    await Bun.sleep(10)
    expect(calls).toEqual([["first"]])

    releaseFirst({ first: "FR First" })
    await waitFor(() => expect(calls).toHaveLength(2))

    expect(maximumActive).toBe(1)
    expect(calls).toEqual([["first"], ["second"]])
  })

  test("keeps blank results missing so the next Manifest state retries them", async () => {
    accelerateLifecycleTimers()
    const root = createPluginRoot()
    const file = join(root, "src/message.tsx")
    writeFileSync(file, `<T id="constructor">First</T>`)
    const calls: string[][] = []
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          type: "local",
          translate: async (messages) => {
            calls.push(messages.map(({ id }) => id))
            if (calls.length === 1) return {}
            return Object.fromEntries(messages.map(({ id, text }) => [id, `FR ${text}`]))
          },
        },
      }),
      root,
    )
    await hooks.buildStart()
    const watcher = configureWatcher(hooks)
    await waitFor(() => expect(calls).toHaveLength(1))

    writeFileSync(file, `<><T id="constructor">First</T><T id="second">Second</T></>`)
    watcher.change!(file)
    await waitFor(() => expect(calls).toHaveLength(2))

    expect(calls).toEqual([["constructor"], ["constructor", "second"]])
    expect(JSON.parse(readFileSync(join(root, "src/lib/bt/locales/fr.json"), "utf8"))).toEqual({
      constructor: "FR First",
      second: "FR Second",
    })
  })

  test("serializes remote Manifest sync and sends the latest snapshot last", async () => {
    accelerateLifecycleTimers()
    const root = createPluginRoot()
    const file = join(root, "src/message.tsx")
    writeFileSync(file, `<T id="stable">Old</T>`)
    const requests: Array<{
      body: { messages: Record<string, { defaultMessage: string }> }
      resolve: (response: Response) => void
    }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input, init) => {
      const body = init?.body
      if (typeof body !== "string") {
        throw new TypeError("Expected a JSON request body")
      }

      return await new Promise<Response>((resolveResponse) => {
        requests.push({
          body: JSON.parse(body) as { messages: Record<string, { defaultMessage: string }> },
          resolve: resolveResponse,
        })
      })
    }) as typeof fetch
    const hooks = resolvePlugin(
      betterTranslation({
        locales: ["en", "fr"],
        logging: false,
        runtime: {
          apiKey: "secret",
          endpoint: "https://example.test",
          projectId: "project",
          type: "remote",
        },
      }),
      root,
    )
    await hooks.buildStart()
    const handlers: Record<string, (file: string) => void> = {}
    let listening!: () => void
    hooks.configureServer({
      httpServer: {
        once(event: string, handler: () => void) {
          if (event === "listening") listening = handler
        },
      },
      middlewares: { use() {} },
      watcher: {
        add() {},
        on(event: string, handler: (file: string) => void) {
          handlers[event] = handler
        },
      },
    })

    try {
      listening()
      await waitFor(() => expect(requests).toHaveLength(1))
      writeFileSync(file, `<T id="stable">New</T>`)
      handlers.change!(file)
      await Bun.sleep(10)
      expect(requests).toHaveLength(1)

      requests[0]!.resolve(new Response(`{"changed":true}`))
      await waitFor(() => expect(requests).toHaveLength(2))
      expect(requests.map(({ body }) => body.messages.stable?.defaultMessage)).toEqual(["Old", "New"])
      requests[1]!.resolve(new Response(`{"changed":true}`))
      await Bun.sleep(10)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe("plugin rich-text repair", () => {
  test("preserves an invalid locale value until a valid translated replacement is ready", async () => {
    accelerateLifecycleTimers()
    const root = mkdtempSync(join(tmpdir(), "better-translation-rich-text-"))
    const sourceDir = join(root, "src")
    const localesDir = join(root, "translations", "locales")
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(localesDir, { recursive: true })
    writeFileSync(join(sourceDir, "message.tsx"), `<T id="safety">Always <strong>safe</strong></T>`)
    writeFileSync(join(localesDir, "fr.json"), `${JSON.stringify({ safety: "Toujours en sécurité" }, null, 2)}\n`)

    const plugin = betterTranslation({
      locales: ["en", "fr"],
      logging: false,
      runtime: {
        type: "local",
        output: "translations",
        translate: async (messages, locale) => {
          expect(locale).toBe("fr")
          expect(messages.map(({ id, text }) => ({ id, text }))).toEqual([{ id: "safety", text: "Always <0>safe</0>" }])
          return { safety: "Toujours <0>en sécurité</0>" }
        },
      },
    })
    const hooks = plugin as unknown as {
      configResolved: (config: ResolvedConfig) => void
      buildStart: () => void | Promise<void>
    }
    hooks.configResolved({
      root,
      command: "serve",
      publicDir: join(root, "public"),
    } as ResolvedConfig)

    try {
      await hooks.buildStart()
      expect(JSON.parse(readFileSync(join(localesDir, "fr.json"), "utf8"))).toEqual({
        safety: "Toujours en sécurité",
      })

      await waitFor(() =>
        expect(JSON.parse(readFileSync(join(localesDir, "fr.json"), "utf8"))).toEqual({
          safety: "Toujours <0>en sécurité</0>",
        }),
      )
      expect(JSON.parse(readFileSync(join(localesDir, "fr.json"), "utf8"))).toEqual({
        safety: "Toujours <0>en sécurité</0>",
      })
    } finally {
      rmSync(root, { recursive: true })
    }
  })
})
