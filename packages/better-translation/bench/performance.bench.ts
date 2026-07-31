import { hasSameMessageStructure, parseRichTextMessage } from "../src/message/template.js"
import { betterTranslation } from "../src/vite-plugin/index.js"
import { ManifestState } from "../src/vite-plugin/manifest-state.js"
import { analyzeSourceFile, type SourceAnalysis } from "../src/vite-plugin/source-analysis/index.js"

const markers = {
  call: ["t", "useT"],
  component: ["T"],
  logging: false,
}
const FOUR_TIMES_INPUT_MAX_RATIO = 12
const FOUR_TIMES_PROJECT_INPUT_MAX_RATIO = 8
const EIGHT_TIMES_SVELTE_RICH_TEXT_MAX_RATIO = 16
const EIGHT_TIMES_INPUT_MAX_RATIO = 24
const INCREMENTAL_PROJECT_SIZE_MAX_RATIO = 4
const PROJECT_MESSAGES_PER_FILE = 16
const MINIMUM_GUARD_SAMPLE_MILLISECONDS = 100
let guardSink: unknown

function collectGarbage() {
  const bunRuntime = globalThis as typeof globalThis & {
    Bun?: { gc(force?: boolean): void }
  }

  if (!bunRuntime.Bun) {
    throw new Error("Performance scaling guards require the Bun runtime.")
  }

  bunRuntime.Bun.gc(true)
}

if (process.argv.includes("--guard")) {
  runScalingGuards()
} else {
  await runBenchmarks()
}

async function runBenchmarks() {
  const { bench, do_not_optimize, run } = await import("mitata")
  const markerCount = 1_000
  const typescriptSource = createTypeScriptWorkload(markerCount)
  const svelteSource = createSvelteWorkload(markerCount)
  const richMessage = createRichMessage(markerCount)
  const reorderedRichMessage = createRichMessage(markerCount, true)
  const typescriptProject = createProjectWorkload(100, "tsx")
  const svelteProject = createProjectWorkload(100, "svelte")
  const cachedManifestState = new ManifestState("/benchmark", false)
  const incrementalManifest = createIncrementalManifestWorkload(1_000)
  const transform = createWarmTransform(createEditWorkload(markerCount), "/benchmark/src/edits.ts")

  assertAnalysis(analyzeSourceFile(typescriptSource, "/benchmark/messages.tsx", markers), {
    edits: markerCount * 1.5,
    messages: markerCount,
    richMessage: "Always <0>keep {name} safe</0>.",
  })
  assertAnalysis(analyzeSourceFile(svelteSource, "/benchmark/messages.svelte", markers), {
    edits: markerCount * 2,
    messages: markerCount,
    richMessage: "Always <0>keep {name} safe</0>.",
  })
  if (parseRichTextMessage(richMessage)?.nodes.length !== markerCount) {
    throw new Error("The rich Message benchmark fixture did not produce the expected nodes")
  }
  if (!hasSameMessageStructure(richMessage, reorderedRichMessage)) {
    throw new Error("The rich Message benchmark fixtures must have matching structure")
  }
  assertProjectAnalysis(analyzeProject(typescriptProject), 100, 1.5)
  assertProjectAnalysis(analyzeProject(svelteProject), 100, 2)
  assertIncrementalManifestUpdate(incrementalManifest())
  cachedManifestState.analyze("/benchmark/messages.tsx", typescriptSource)

  bench("analyze TypeScript with 1,000 mixed Translation markers", () => {
    do_not_optimize(analyzeSourceFile(typescriptSource, "/benchmark/messages.tsx", markers))
  })

  bench("analyze Svelte with 1,000 mixed Translation markers", () => {
    do_not_optimize(analyzeSourceFile(svelteSource, "/benchmark/messages.svelte", markers))
  })

  bench("parse a rich Message with 1,000 elements and placeholders", () => {
    do_not_optimize(parseRichTextMessage(richMessage))
  })

  bench("validate reordered rich Messages with 1,000 elements and placeholders", () => {
    do_not_optimize(hasSameMessageStructure(richMessage, reorderedRichMessage))
  })

  bench("cold Manifest sync with 1,000 TypeScript Translation markers", () => {
    const state = new ManifestState("/benchmark", false)
    do_not_optimize(state.sync("/benchmark/messages.tsx", typescriptSource))
  })

  bench("analyze 100 TypeScript files with 16 Translation markers each", () => {
    do_not_optimize(analyzeProject(typescriptProject))
  })

  bench("analyze 100 Svelte files with 16 Translation markers each", () => {
    do_not_optimize(analyzeProject(svelteProject))
  })

  bench("update one 16-Message file in a 1,000-file Manifest", () => {
    do_not_optimize(incrementalManifest())
  })

  bench("exact-revision Manifest analysis cache hit", () => {
    do_not_optimize(cachedManifestState.analyze("/benchmark/messages.tsx", typescriptSource))
  })

  bench("apply 1,000 cached source edits", () => {
    do_not_optimize(transform())
  })

  if (process.argv.includes("--json")) {
    const result = await run({ format: "quiet", throw: true })
    console.log(
      JSON.stringify(
        {
          context: {
            architecture: result.context.arch,
            cpu: result.context.cpu.name,
            runtime: result.context.runtime,
          },
          benchmarks: result.benchmarks.flatMap((benchmark) =>
            benchmark.runs.flatMap((benchmarkRun) =>
              benchmarkRun.stats
                ? [
                    {
                      averageNanoseconds: benchmarkRun.stats.avg,
                      heapBytes: benchmarkRun.stats.heap?.avg,
                      name: benchmarkRun.name,
                      p50Nanoseconds: benchmarkRun.stats.p50,
                      p99Nanoseconds: benchmarkRun.stats.p99,
                    },
                  ]
                : [],
            ),
          ),
        },
        null,
        2,
      ),
    )
    return
  }
  await run({ throw: true })
}

function runScalingGuards() {
  const smallMarkerCount = 500
  const largeMarkerCount = 2_000
  const smallTypeScriptSource = createTypeScriptWorkload(smallMarkerCount)
  const largeTypeScriptSource = createTypeScriptWorkload(largeMarkerCount)
  const smallSvelteSource = createSvelteWorkload(smallMarkerCount)
  const largeSvelteSource = createSvelteWorkload(largeMarkerCount)
  const smallSvelteRichTextSource = createSvelteRichTextWorkload(250)
  const largeSvelteRichTextSource = createSvelteRichTextWorkload(2_000)
  const smallRichMessage = createRichMessage(256)
  const largeRichMessage = createRichMessage(2_048)
  const smallTypeScriptProject = createProjectWorkload(25, "tsx")
  const largeTypeScriptProject = createProjectWorkload(100, "tsx")
  const smallSvelteProject = createProjectWorkload(25, "svelte")
  const largeSvelteProject = createProjectWorkload(100, "svelte")
  const smallIncrementalManifest = createIncrementalManifestWorkload(100)
  const largeIncrementalManifest = createIncrementalManifestWorkload(1_000)
  const smallTransform = createWarmTransform(createEditWorkload(smallMarkerCount), "/benchmark/src/small-edits.ts")
  const largeTransform = createWarmTransform(createEditWorkload(largeMarkerCount), "/benchmark/src/large-edits.ts")

  assertAnalysis(analyzeSourceFile(smallTypeScriptSource, "/benchmark/small.tsx", markers), {
    edits: smallMarkerCount * 1.5,
    messages: smallMarkerCount,
    richMessage: "Always <0>keep {name} safe</0>.",
  })
  assertAnalysis(analyzeSourceFile(largeTypeScriptSource, "/benchmark/large.tsx", markers), {
    edits: largeMarkerCount * 1.5,
    messages: largeMarkerCount,
    richMessage: "Always <0>keep {name} safe</0>.",
  })
  assertAnalysis(analyzeSourceFile(smallSvelteSource, "/benchmark/small.svelte", markers), {
    edits: smallMarkerCount * 2,
    messages: smallMarkerCount,
    richMessage: "Always <0>keep {name} safe</0>.",
  })
  assertAnalysis(analyzeSourceFile(largeSvelteSource, "/benchmark/large.svelte", markers), {
    edits: largeMarkerCount * 2,
    messages: largeMarkerCount,
    richMessage: "Always <0>keep {name} safe</0>.",
  })
  assertAnalysis(analyzeSourceFile(smallSvelteRichTextSource, "/benchmark/small-rich-text.svelte", markers), {
    edits: 250 * 4,
    messages: 250 * 2,
    richMessage: "<0>Safe 0</0>",
  })
  assertAnalysis(analyzeSourceFile(largeSvelteRichTextSource, "/benchmark/large-rich-text.svelte", markers), {
    edits: 2_000 * 4,
    messages: 2_000 * 2,
    richMessage: "<0>Safe 0</0>",
  })
  if (parseRichTextMessage(smallRichMessage)?.nodes.length !== 256) {
    throw new Error("The small rich Message guard fixture did not produce the expected nodes")
  }
  if (parseRichTextMessage(largeRichMessage)?.nodes.length !== 2_048) {
    throw new Error("The large rich Message guard fixture did not produce the expected nodes")
  }
  if (createSharedSourceManifest(largeMarkerCount).manifest.shared?.sources.length !== largeMarkerCount) {
    throw new Error("The shared-source Manifest guard fixture did not produce the expected sources")
  }
  assertProjectAnalysis(analyzeProject(smallTypeScriptProject), 25, 1.5)
  assertProjectAnalysis(analyzeProject(largeTypeScriptProject), 100, 1.5)
  assertProjectAnalysis(analyzeProject(smallSvelteProject), 25, 2)
  assertProjectAnalysis(analyzeProject(largeSvelteProject), 100, 2)
  assertIncrementalManifestUpdate(smallIncrementalManifest())
  assertIncrementalManifestUpdate(largeIncrementalManifest())

  const guards = [
    {
      large: () => analyzeSourceFile(largeTypeScriptSource, "/benchmark/large.tsx", markers),
      largeInput: "2,000 markers",
      inputScale: 4,
      maxRatio: FOUR_TIMES_INPUT_MAX_RATIO,
      name: "TypeScript analysis",
      small: () => analyzeSourceFile(smallTypeScriptSource, "/benchmark/small.tsx", markers),
      smallInput: "500 markers",
    },
    {
      large: () => analyzeSourceFile(largeSvelteSource, "/benchmark/large.svelte", markers),
      largeInput: "2,000 markers",
      inputScale: 4,
      maxRatio: FOUR_TIMES_INPUT_MAX_RATIO,
      name: "Svelte analysis",
      small: () => analyzeSourceFile(smallSvelteSource, "/benchmark/small.svelte", markers),
      smallInput: "500 markers",
    },
    {
      large: () => analyzeSourceFile(largeSvelteRichTextSource, "/benchmark/large-rich-text.svelte", markers),
      largeInput: "2,000 rich-text siblings",
      inputScale: 8,
      maxRatio: EIGHT_TIMES_SVELTE_RICH_TEXT_MAX_RATIO,
      name: "Svelte sibling Rich-text Message analysis",
      small: () => analyzeSourceFile(smallSvelteRichTextSource, "/benchmark/small-rich-text.svelte", markers),
      smallInput: "250 rich-text siblings",
    },
    {
      large: () => parseRichTextMessage(largeRichMessage),
      largeInput: "2,048 elements",
      inputScale: 8,
      maxRatio: EIGHT_TIMES_INPUT_MAX_RATIO,
      name: "Message-template parsing",
      small: () => parseRichTextMessage(smallRichMessage),
      smallInput: "256 elements",
    },
    {
      large: () => analyzeProject(largeTypeScriptProject),
      largeInput: "100 files",
      inputScale: 4,
      maxRatio: FOUR_TIMES_PROJECT_INPUT_MAX_RATIO,
      name: "Project-shaped TypeScript analysis",
      small: () => analyzeProject(smallTypeScriptProject),
      smallInput: "25 files",
    },
    {
      large: () => analyzeProject(largeSvelteProject),
      largeInput: "100 files",
      inputScale: 4,
      maxRatio: FOUR_TIMES_PROJECT_INPUT_MAX_RATIO,
      name: "Project-shaped Svelte analysis",
      small: () => analyzeProject(smallSvelteProject),
      smallInput: "25 files",
    },
    {
      large: largeIncrementalManifest,
      largeInput: "1,000 files",
      inputScale: 10,
      maxRatio: INCREMENTAL_PROJECT_SIZE_MAX_RATIO,
      name: "Incremental Manifest update across project sizes",
      small: smallIncrementalManifest,
      smallInput: "100 files",
    },
    {
      large: () => createSharedSourceManifest(largeMarkerCount),
      largeInput: "2,000 sources",
      inputScale: 4,
      maxRatio: FOUR_TIMES_INPUT_MAX_RATIO,
      name: "Manifest shared-source aggregation",
      small: () => createSharedSourceManifest(smallMarkerCount),
      smallInput: "500 sources",
    },
    {
      large: largeTransform,
      largeInput: "2,000 edits",
      inputScale: 4,
      maxRatio: FOUR_TIMES_INPUT_MAX_RATIO,
      name: "Cached source-edit application",
      small: smallTransform,
      smallInput: "500 edits",
    },
  ]

  console.log("Performance scaling guards")
  for (const guard of guards) {
    guard.small()
    guard.large()
    const smallIterations = calibrate(guard.small)
    const largeIterations = calibrate(guard.large)
    const smallSamples: number[] = []
    const largeSamples: number[] = []
    for (let index = 0; index < 5; index++) {
      if (index % 2 === 0) {
        smallSamples.push(measure(guard.small, smallIterations) / smallIterations)
        largeSamples.push(measure(guard.large, largeIterations) / largeIterations)
      } else {
        largeSamples.push(measure(guard.large, largeIterations) / largeIterations)
        smallSamples.push(measure(guard.small, smallIterations) / smallIterations)
      }
    }
    const smallMedian = median(smallSamples)
    const largeMedian = median(largeSamples)
    const ratio = largeMedian / smallMedian
    console.log(
      `${guard.name} — ${guard.smallInput} -> ${guard.largeInput} (${guard.inputScale}x input): ${formatMilliseconds(smallMedian)} -> ${formatMilliseconds(largeMedian)} (${ratio.toFixed(2)}x time; budget <${guard.maxRatio}x)`,
    )
    if (ratio >= guard.maxRatio) {
      throw new Error(`${guard.name} exceeded its ${guard.maxRatio}x scaling budget with a ${ratio.toFixed(2)}x increase`)
    }
  }
  if (guardSink === undefined) throw new Error("Performance scaling guards did not execute their workloads")
}

function calibrate(operation: () => unknown) {
  let iterations = 1
  while (true) {
    const duration = measure(operation, iterations)
    if (duration >= MINIMUM_GUARD_SAMPLE_MILLISECONDS * 1_000_000) return iterations
    iterations = Math.max(iterations + 1, Math.ceil((iterations * MINIMUM_GUARD_SAMPLE_MILLISECONDS * 1_000_000) / duration))
  }
}

function measure(operation: () => unknown, iterations: number) {
  collectGarbage()
  const start = performance.now()
  for (let index = 0; index < iterations; index++) guardSink = operation()
  return (performance.now() - start) * 1_000_000
}

function median(samples: number[]) {
  return [...samples].sort((left, right) => left - right)[Math.floor(samples.length / 2)]!
}

function formatMilliseconds(nanoseconds: number) {
  return `${(nanoseconds / 1_000_000).toFixed(2)} ms`
}

function assertAnalysis(
  analysis: SourceAnalysis,
  expected: {
    edits: number
    messages: number
    richMessage?: string
  },
) {
  if (!analysis.parsed || analysis.messages.length !== expected.messages) {
    throw new Error(`Expected ${expected.messages} Messages but received ${analysis.messages.length}`)
  }
  if (analysis.edits.length !== expected.edits) {
    throw new Error(`Expected ${expected.edits} source edits but received ${analysis.edits.length}`)
  }
  if (analysis.diagnostics?.length) {
    throw new Error(`Expected no diagnostics but received ${analysis.diagnostics.length}`)
  }
  if (expected.richMessage && !analysis.messages.some((message) => message.defaultMessage === expected.richMessage)) {
    throw new Error(`Expected representative rich Message ${JSON.stringify(expected.richMessage)}`)
  }
}

function createWarmTransform(source: string, filename: string) {
  const plugin = betterTranslation({ locales: ["en"], logging: false }) as unknown as {
    configResolved: (config: { command: "serve"; publicDir: string; root: string }) => void
    transform: (code: string, id: string) => { code: string } | undefined
  }
  plugin.configResolved({
    command: "serve",
    publicDir: "/benchmark/public",
    root: "/benchmark",
  })
  const analysis = analyzeSourceFile(source, filename, markers)
  assertAnalysis(analysis, { edits: analysis.messages.length, messages: analysis.messages.length })
  const transformed = plugin.transform(source, filename)
  if (!transformed || transformed.code === source) throw new Error("The source-edit benchmark fixture produced no edits")
  return () => plugin.transform(source, filename)
}

function createSharedSourceManifest(count: number) {
  const state = new ManifestState("/benchmark", false)
  for (let index = 0; index < count; index++) {
    state.sync(`/benchmark/source-${index}.tsx`, `<T id="shared">Hello</T>`)
  }
  return state
}

function createProjectWorkload(fileCount: number, extension: "svelte" | "tsx") {
  return Array.from({ length: fileCount }, (_, index) => ({
    filename: `/benchmark/project/source-${index}.${extension}`,
    source:
      extension === "svelte"
        ? createSvelteWorkload(PROJECT_MESSAGES_PER_FILE)
        : createTypeScriptWorkload(PROJECT_MESSAGES_PER_FILE),
  }))
}

function analyzeProject(project: Array<{ filename: string; source: string }>) {
  let edits = 0
  let messages = 0
  for (const file of project) {
    const analysis = analyzeSourceFile(file.source, file.filename, markers)
    if (!analysis.parsed || analysis.diagnostics?.length) {
      throw new Error(`The project-shaped benchmark could not analyze ${file.filename}`)
    }
    edits += analysis.edits.length
    messages += analysis.messages.length
  }
  return { edits, messages }
}

function assertProjectAnalysis(analysis: { edits: number; messages: number }, fileCount: number, editsPerMessage: number) {
  const messages = fileCount * PROJECT_MESSAGES_PER_FILE
  const edits = messages * editsPerMessage
  if (analysis.messages !== messages || analysis.edits !== edits) {
    throw new Error(
      `Expected ${messages} project Messages and ${edits} edits but received ${analysis.messages} Messages and ${analysis.edits} edits`,
    )
  }
}

function createIncrementalManifestWorkload(fileCount: number) {
  const state = new ManifestState("/benchmark", false)
  for (let index = 0; index < fileCount; index++) {
    state.sync(`/benchmark/project/source-${index}.tsx`, createManifestFileSource(index, 0))
  }
  let revision = 0

  return () => {
    revision = revision === 0 ? 1 : 0
    return state.sync("/benchmark/project/source-0.tsx", createManifestFileSource(0, revision))
  }
}

function createManifestFileSource(fileIndex: number, revision: number) {
  return Array.from(
    { length: PROJECT_MESSAGES_PER_FILE },
    (_, messageIndex) =>
      `const message${messageIndex} = <T id="project-${fileIndex}-${messageIndex}">Message ${messageIndex}, revision ${revision}</T>`,
  ).join("\n")
}

function assertIncrementalManifestUpdate(result: ReturnType<ManifestState["sync"]>) {
  if (!result?.manifestChanged || !result.localeMessagesChanged) {
    throw new Error("The incremental Manifest benchmark did not change its target file")
  }
}

function createEditWorkload(count: number) {
  return Array.from({ length: count }, (_, index) => `const message${index} = t("Message ${index}")`).join("\n")
}

function createRichMessage(count: number, reverse = false) {
  return Array.from({ length: count }, (_, offset) => {
    const index = reverse ? count - offset - 1 : offset
    return `<${index}>{value${index}}</${index}>`
  }).join("")
}

function createTypeScriptWorkload(count: number) {
  return Array.from({ length: count / 2 }, (_, index) =>
    [
      `const call${index} = t("Call message ${index} for {name}", { name })`,
      `const view${index} = <T id="rich-${index}">Always <strong>keep <Var>{name}</Var> safe</strong>.</T>`,
    ].join("\n"),
  ).join("\n")
}

function createSvelteWorkload(count: number) {
  const calls = Array.from(
    { length: count / 2 },
    (_, index) => `const call${index} = t("Call message ${index} for {name}", { name })`,
  ).join("\n")
  const components = Array.from(
    { length: count / 2 },
    (_, index) => `<T id="rich-${index}">Always <strong>keep <Var {name} /> safe</strong>.</T>`,
  ).join("\n")
  return `<script>\n${calls}\n</script>\n${components}`
}

function createSvelteRichTextWorkload(count: number) {
  const calls = Array.from({ length: count }, (_, index) => `const tooltip${index} = t("Tooltip ${index}")`).join("\n")
  const components = Array.from({ length: count }, (_, index) => `<T><Badge>Safe ${index}</Badge></T>`).join("\n")
  return `<script>\n${calls}\n</script>\n${components}`
}
