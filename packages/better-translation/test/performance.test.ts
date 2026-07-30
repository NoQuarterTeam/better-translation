import { describe, expect, test } from "bun:test"

import { comparePerformanceReports } from "../bench/compare-performance.js"

function report(benchmarks: Record<string, number>) {
  return {
    benchmarks: Object.entries(benchmarks).map(([name, p50Nanoseconds]) => ({ name, p50Nanoseconds })),
    context: {
      architecture: "arm64",
      cpu: "test cpu",
      runtime: "bun",
    },
  }
}

describe("performance report comparison", () => {
  test("requires both the relative and absolute budgets to fail", () => {
    const comparison = comparePerformanceReports(
      report({ "fast operation": 100_000, "meaningful operation": 2_000_000 }),
      report({ "fast operation": 200_000, "meaningful operation": 3_000_001 }),
    )

    expect(comparison.regressions).toEqual(["meaningful operation increased by 50% and 1.00 ms"])
    expect(comparison.markdown).toContain("| fast operation | 100.00 µs | 200.00 µs | +100% | ok |")
    expect(comparison.markdown).toContain("| meaningful operation | 2.00 ms | 3.00 ms | +50% | regression |")
  })

  test("reports removed and newly added benchmarks explicitly", () => {
    const comparison = comparePerformanceReports(report({ removed: 1_000_000 }), report({ added: 2_000_000 }))

    expect(comparison.regressions).toEqual(["removed is missing from the current benchmark report"])
    expect(comparison.markdown).toContain("| removed | 1.00 ms | missing | — | regression |")
    expect(comparison.markdown).toContain("| added | new | 2.00 ms | — | new |")
  })
})
