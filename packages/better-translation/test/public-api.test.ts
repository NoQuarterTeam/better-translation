import { expect, test } from "bun:test"
import type { ComponentProps } from "svelte"

import type * as PublicReactApi from "better-translation/react"
import type * as PublicRuntimeApi from "better-translation/runtime"
import type * as PublicSvelteApi from "better-translation/svelte"
import type * as PublicViteApi from "better-translation/vite"

test("keeps the published package entrypoints type-resolvable", () => {
  type ReactApi = typeof PublicReactApi
  type RuntimeApi = typeof PublicRuntimeApi
  type SvelteApi = typeof PublicSvelteApi
  type ViteApi = typeof PublicViteApi
  type PublicReactTProps = Parameters<ReactApi["T"]>[0]
  type PublicSvelteTProps = ComponentProps<SvelteApi["T"]>

  const reactExport: keyof ReactApi = "T"
  const runtimeExport: keyof RuntimeApi = "createT"
  const svelteExport: keyof SvelteApi = "T"
  const viteExport: keyof ViteApi = "betterTranslation"
  const reactTransformPropsArePrivate: Extract<"message" | "values", keyof PublicReactTProps> extends never ? true : false = true
  const svelteProps = { context: "Translator guidance", id: "explicit" } satisfies PublicSvelteTProps

  expect([reactExport, runtimeExport, svelteExport, viteExport, reactTransformPropsArePrivate, svelteProps.context]).toEqual([
    "T",
    "createT",
    "T",
    "betterTranslation",
    true,
    "Translator guidance",
  ])
})
