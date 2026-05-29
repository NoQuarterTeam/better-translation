import type { RuntimeMessages } from "./types.js"

export const locales: readonly string[] = []

export type Locale = string

export async function loadMessages(_locale: string): Promise<RuntimeMessages> {
  throw new Error("better-translation/messages must be loaded through the Better Translation Vite plugin.")
}
