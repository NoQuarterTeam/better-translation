import messages_en from "./locales/en.json"
import messages_nl from "./locales/nl.json"
import messages_fr from "./locales/fr.json"
import messages_es from "./locales/es.json"

export type AppLocale = "en" | "nl" | "fr" | "es"

export async function loadMessages(locale: AppLocale): Promise<Record<string, string>> {
  switch (locale) {
    case "en": return messages_en
    case "nl": return messages_nl
    case "fr": return messages_fr
    case "es": return messages_es
    default: return messages_en
  }
}
