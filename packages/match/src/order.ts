/** Canonical Tailwind class sort ordinal. Lower sorts first. */
export const CLASS_ORDER: string[] = [
  'flex',
  'inline-flex',
  'grid',
  'block',
  'hidden',
  'flex-row',
  'flex-col',
  'flex-wrap',
  'items-',
  'justify-',
  'self-',
  'gap-',
  'p-',
  'px-',
  'py-',
  'pt-',
  'pr-',
  'pb-',
  'pl-',
  'm-',
  'mx-',
  'my-',
  'mt-',
  'mr-',
  'mb-',
  'ml-',
  'w-',
  'h-',
  'rounded',
  'border',
  'bg-',
  'text-',
  'font-',
  'leading-',
  'tracking-',
  'shadow',
  'opacity-',
  'italic',
  'not-italic',
  'underline',
  'no-underline',
]

/** Sort key for a class name. */
export const classOrdinal = (className: string): number => {
  for (let i = 0; i < CLASS_ORDER.length; i += 1) {
    const prefix = CLASS_ORDER[i]
    if (!prefix) continue
    if (className === prefix || className.startsWith(prefix)) {
      return i
    }
  }
  return CLASS_ORDER.length + 1
}

/** Sort class names by canonical order then lexicographically. */
export const sortClasses = (classes: string[]): string[] =>
  [...classes].sort((a, b) => {
    const ord = classOrdinal(a) - classOrdinal(b)
    if (ord !== 0) return ord
    return a < b ? -1 : a > b ? 1 : 0
  })
