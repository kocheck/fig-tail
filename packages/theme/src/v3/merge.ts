/** Deep-merge like Tailwind: objects recurse; arrays and primitives replace. */
export const mergeThemeValue = (base: unknown, extension: unknown): unknown => {
  if (Array.isArray(extension)) {
    return extension.slice()
  }
  if (
    extension !== null &&
    typeof extension === 'object' &&
    !Array.isArray(extension) &&
    base !== null &&
    typeof base === 'object' &&
    !Array.isArray(base)
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
    for (const [key, value] of Object.entries(extension as Record<string, unknown>)) {
      out[key] = mergeThemeValue((base as Record<string, unknown>)[key], value)
    }
    return out
  }
  if (extension === undefined) {
    return base
  }
  return extension
}

/** Merge theme + theme.extend onto defaults with replace-vs-extend semantics. */
export const applyThemeConfig = (
  defaults: Record<string, unknown>,
  theme: Record<string, unknown> | undefined,
): {
  merged: Record<string, unknown>
  replacedNamespaces: string[]
  extendedNamespaces: string[]
  unresolvableReplace: string[]
  unresolvableExtend: string[]
} => {
  const merged: Record<string, unknown> = { ...defaults }
  const replacedNamespaces: string[] = []
  const extendedNamespaces: string[] = []
  const unresolvableReplace: string[] = []
  const unresolvableExtend: string[] = []

  if (!theme) {
    return {
      merged,
      replacedNamespaces,
      extendedNamespaces,
      unresolvableReplace,
      unresolvableExtend,
    }
  }

  const extend =
    theme.extend && typeof theme.extend === 'object' && !Array.isArray(theme.extend)
      ? (theme.extend as Record<string, unknown>)
      : undefined

  for (const [key, value] of Object.entries(theme)) {
    if (key === 'extend') continue
    if (value === undefined) {
      unresolvableReplace.push(key)
      delete merged[key]
      replacedNamespaces.push(key)
      continue
    }
    merged[key] = value
    replacedNamespaces.push(key)
  }

  if (extend) {
    for (const [key, value] of Object.entries(extend)) {
      if (value === undefined) {
        unresolvableExtend.push(key)
        continue
      }
      merged[key] = mergeThemeValue(merged[key], value)
      extendedNamespaces.push(key)
    }
  }

  return {
    merged,
    replacedNamespaces,
    extendedNamespaces,
    unresolvableReplace,
    unresolvableExtend,
  }
}
