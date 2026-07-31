import { expect, test } from "bun:test"

import packageJson from "../package.json" with { type: "json" }

test("uses registry-compatible production dependency specifiers", () => {
  for (const specifier of Object.values(packageJson.dependencies)) {
    expect(specifier).not.toMatch(/^(catalog|workspace):/)
  }
})
