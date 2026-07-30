const SUPPORTED_RICH_TEXT_ELEMENTS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
])

export function isSupportedRichTextElement(name: string) {
  return SUPPORTED_RICH_TEXT_ELEMENTS.has(name)
}

export function isVoidRichTextElement(name: string) {
  return name === "br" || name === "wbr"
}
