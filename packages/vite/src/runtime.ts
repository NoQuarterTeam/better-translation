import type { BetterTranslateRuntimeConfig, RuntimeMessages } from "./types.js"

/** Loads one locale from the Vite-generated virtual module in route/load-time code. */
export async function getRouteMessages(locale: string): Promise<RuntimeMessages> {
  const runtime = await loadBundledRuntime()
  if (!runtime) return {}
  return runtime.loadLocaleMessages(locale)
}

/** Reads the generated runtime config from the Vite virtual module when available. */
export async function getRouteRuntimeConfig(): Promise<BetterTranslateRuntimeConfig | null> {
  const runtime = await loadBundledRuntime()
  return runtime?.runtimeConfig ?? null
}

async function loadBundledRuntime() {
  try {
    const module = await import("virtual:better-translate/messages")
    return module as {
      runtimeConfig: BetterTranslateRuntimeConfig
      loadLocaleMessages: (locale: string) => Promise<RuntimeMessages>
    }
  } catch {
    return null
  }
}
