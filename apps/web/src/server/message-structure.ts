type RichTextElement = {
  kind: "paired" | "self-closing"
  parent?: number
}

/**
 * Hosted-service mirror of the package's private Message-structure invariant.
 *
 * Manifest sync must reject Locale values that change placeholder multiplicity
 * or a Rich-text tag's paired/self-closing kind and authored parent topology,
 * without exposing the runtime parser as public API.
 */
export function hasSameMessageStructure(sourceMessage: string, translatedMessage: string) {
  const sourceVariables = getMessageVariables(sourceMessage)
  const translatedVariables = getMessageVariables(translatedMessage)
  if (
    sourceVariables.size !== translatedVariables.size ||
    [...sourceVariables].some(([variable, count]) => translatedVariables.get(variable) !== count)
  ) {
    return false
  }

  const sourceElements = getRichTextElements(sourceMessage)
  const translatedElements = getRichTextElements(translatedMessage)
  if (!sourceElements || !translatedElements || sourceElements.size !== translatedElements.size) return false

  return [...sourceElements].every(([index, element]) => {
    const translatedElement = translatedElements.get(index)
    return translatedElement?.kind === element.kind && translatedElement.parent === element.parent
  })
}

function getMessageVariables(message: string) {
  const variables = new Map<string, number>()
  for (const match of message.matchAll(/\{(\w+)\}/g)) {
    if (match[1]) variables.set(match[1], (variables.get(match[1]) ?? 0) + 1)
  }
  return variables
}

function getRichTextElements(message: string) {
  const elements = new Map<number, RichTextElement>()
  const stack: number[] = []

  for (const match of message.matchAll(/<(\/?)(\d+)(\/?)>/g)) {
    const indexText = match[2]
    if (!indexText) return undefined

    const index = Number(indexText)
    if (!Number.isSafeInteger(index) || String(index) !== indexText) return undefined

    const closing = match[1] === "/"
    const selfClosing = match[3] === "/"
    if (closing) {
      if (selfClosing || stack.pop() !== index) return undefined
      continue
    }

    if (elements.has(index)) return undefined
    elements.set(index, {
      kind: selfClosing ? "self-closing" : "paired",
      ...(stack.at(-1) === undefined ? {} : { parent: stack.at(-1) }),
    })
    if (!selfClosing) stack.push(index)
  }

  return stack.length === 0 ? elements : undefined
}
