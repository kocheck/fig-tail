/**
 * A type reference: an identifier or qualified name, optional generic
 * arguments, optional array suffix, and unions of those.
 *
 * Deliberately unable to span `,`, `{`, `}`, a bare `[`, or plain whitespace
 * between two identifiers. A looser pattern reads an object literal's
 * `key: value` as an annotation and eats the value — `colors: { ...colors }`
 * became `colors,` — and reads everything after `satisfies Config` as part of
 * the type, taking the file's `export default` with it.
 */
const ATOM = String.raw`(?:[A-Za-z0-9_$.]|<[^<>]*>)+(?:\[\s*\])*`
const TYPE = `${ATOM}(?:\\s*\\|\\s*${ATOM})*`

/** Strip TypeScript-only syntax so acorn can parse config files. */
export const stripTypeScript = (source: string): string => {
  let text = source
  text = text.replace(/^\s*import\s+type\s+[\s\S]*?;\s*$/gm, '')
  text = text.replace(/\bimport\s+type\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '')
  text = text.replace(new RegExp(`\\bsatisfies\\s+${TYPE}`, 'g'), '')
  text = text.replace(/\bas\s+const\b/g, '')
  text = text.replace(new RegExp(`:\\s*${TYPE}(?=\\s*[=,)])`, 'g'), '')
  text = text.replace(new RegExp(`\\bas\\s+${TYPE}`, 'g'), '')
  return text
}
