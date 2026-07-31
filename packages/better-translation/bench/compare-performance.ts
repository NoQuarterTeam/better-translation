import { readFile } from "node:fs/promises"

interface BenchmarkResult {
  name: string
  p50Nanoseconds: number
}

interface BenchmarkReport {
  benchmarks: BenchmarkResult[]
  context: {
    architecture: string
    cpu: string
    runtime: string
  }
}

export interface PerformanceComparison {
  markdown: string
  regressions: string[]
}

const DEFAULT_MAX_TIME_RATIO = 1.25
const DEFAULT_MINIMUM_REGRESSION_NANOSECONDS = 500_000

/**
 * Compares two statistically sampled benchmark reports.
 *
 * A result is treated as a regression only when it exceeds both the relative
 * and absolute budgets. Requiring both keeps sub-millisecond noise from making
 * CI flaky while still protecting meaningful compiler work.
 */
export function comparePerformanceReports(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
  options: {
    maxTimeRatio?: number
    minimumRegressionNanoseconds?: number
  } = {},
): PerformanceComparison {
  const maxTimeRatio = options.maxTimeRatio ?? DEFAULT_MAX_TIME_RATIO
  const minimumRegressionNanoseconds = options.minimumRegressionNanoseconds ?? DEFAULT_MINIMUM_REGRESSION_NANOSECONDS
  const currentByName = new Map(current.benchmarks.map((benchmark) => [benchmark.name, benchmark]))
  const regressions: string[] = []
  const rows = baseline.benchmarks.map((baselineBenchmark) => {
    const currentBenchmark = currentByName.get(baselineBenchmark.name)
    if (!currentBenchmark) {
      regressions.push(`${baselineBenchmark.name} is missing from the current benchmark report`)
      return `| ${baselineBenchmark.name} | ${formatDuration(baselineBenchmark.p50Nanoseconds)} | missing | — | regression |`
    }

    currentByName.delete(baselineBenchmark.name)
    const difference = currentBenchmark.p50Nanoseconds - baselineBenchmark.p50Nanoseconds
    const timeRatio = currentBenchmark.p50Nanoseconds / baselineBenchmark.p50Nanoseconds
    const regressed = timeRatio > maxTimeRatio && difference >= minimumRegressionNanoseconds
    if (regressed) {
      regressions.push(`${baselineBenchmark.name} increased by ${formatPercent(timeRatio - 1)} and ${formatDuration(difference)}`)
    }

    return `| ${baselineBenchmark.name} | ${formatDuration(baselineBenchmark.p50Nanoseconds)} | ${formatDuration(currentBenchmark.p50Nanoseconds)} | ${formatSignedPercent(timeRatio - 1)} | ${regressed ? "regression" : "ok"} |`
  })

  for (const benchmark of currentByName.values()) {
    rows.push(`| ${benchmark.name} | new | ${formatDuration(benchmark.p50Nanoseconds)} | — | new |`)
  }

  const contextWarning =
    baseline.context.architecture === current.context.architecture && baseline.context.cpu === current.context.cpu
      ? []
      : [`> Warning: reports were recorded on different hardware (${baseline.context.cpu} vs ${current.context.cpu}).`, ""]
  const markdown = [
    "## Compiler performance comparison",
    "",
    `Budget: more than ${formatPercent(maxTimeRatio - 1)} slower and at least ${formatDuration(minimumRegressionNanoseconds)} slower.`,
    "",
    ...contextWarning,
    "| Benchmark | Base p50 | Current p50 | Change | Result |",
    "| --- | ---: | ---: | ---: | --- |",
    ...rows,
  ].join("\n")

  return { markdown, regressions }
}

function formatDuration(nanoseconds: number) {
  if (Math.abs(nanoseconds) >= 1_000_000) return `${(nanoseconds / 1_000_000).toFixed(2)} ms`
  return `${(nanoseconds / 1_000).toFixed(2)} µs`
}

function formatPercent(ratio: number) {
  return `${(ratio * 100).toFixed(0)}%`
}

function formatSignedPercent(ratio: number) {
  return `${ratio >= 0 ? "+" : ""}${formatPercent(ratio)}`
}

async function main() {
  const baselinePath = readArgument("--base")
  const currentPath = readArgument("--current")
  const comparison = comparePerformanceReports(
    JSON.parse(await readFile(baselinePath, "utf8")) as BenchmarkReport,
    JSON.parse(await readFile(currentPath, "utf8")) as BenchmarkReport,
  )

  console.log(comparison.markdown)
  if (comparison.regressions.length > 0) {
    throw new Error(`Performance regression budget exceeded:\n- ${comparison.regressions.join("\n- ")}`)
  }
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name)
  const value = process.argv[index + 1]
  if (index === -1 || !value || value.startsWith("-")) {
    throw new Error(`Missing required ${name} <report.json> argument`)
  }
  return value
}

if (import.meta.main) {
  await main()
}
