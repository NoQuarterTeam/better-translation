import messages_en from "./en.json"
import messages_nl from "./nl.json"
import messages_fr from "./fr.json"
import messages_es from "./es.json"
import runtimeConfig from "./runtime.json"

export { runtimeConfig }

export async function loadMessages(locale) {
  switch (locale) {
    case "en": return messages_en
    case "nl": return messages_nl
    case "fr": return messages_fr
    case "es": return messages_es
    default: return messages_en
  }
}
