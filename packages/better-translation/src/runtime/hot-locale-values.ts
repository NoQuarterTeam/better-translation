/** Internal Vite and browser event used to deliver completed local development translations. */
export const LOCALE_VALUES_HOT_UPDATE_EVENT = "better-translation:locale-values"

/** Internal payload containing newly persisted Locale values for one translation batch. */
export interface LocaleValuesHotUpdate {
  locale: string
  messages: Record<string, string>
}

/** Subscribes a runtime provider to completed local development translations. */
export function subscribeToLocaleValuesHotUpdates(listener: (update: LocaleValuesHotUpdate) => void) {
  if (typeof window === "undefined") return

  const handleUpdate = (event: Event) => {
    listener((event as CustomEvent<LocaleValuesHotUpdate>).detail)
  }
  window.addEventListener(LOCALE_VALUES_HOT_UPDATE_EVENT, handleUpdate)
  return () => window.removeEventListener(LOCALE_VALUES_HOT_UPDATE_EVENT, handleUpdate)
}
