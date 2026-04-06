declare module "virtual:better-translate/messages" {
  import type { BetterTranslateRuntimeConfig, RuntimeMessages } from "./types.js"

  export const runtimeConfig: BetterTranslateRuntimeConfig
  export function loadLocaleMessages(locale: string): Promise<RuntimeMessages>
}
