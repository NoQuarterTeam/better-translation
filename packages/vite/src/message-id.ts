export function getMessageId(message: string) {
  let hash = 2166136261

  for (let i = 0; i < message.length; i++) {
    hash ^= message.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return `m_${(hash >>> 0).toString(36)}`
}
