export function getOwnValue<T>(record: Record<string, T>, key: string) {
  return Object.hasOwn(record, key) ? record[key] : undefined
}

export function normalizeValues(values?: Record<string, unknown>) {
  if (!values) return undefined

  const normalized = Object.create(null) as Record<string, string>
  let hasValues = false
  for (const [name, value] of Object.entries(values)) {
    normalized[name] = String(value)
    hasValues = true
  }
  return hasValues ? normalized : undefined
}
