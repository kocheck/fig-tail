/** Strip TypeScript-only syntax so acorn can parse config files. */
export const stripTypeScript = (source: string): string => {
  let text = source
  text = text.replace(/^\s*import\s+type\s+[\s\S]*?;\s*$/gm, '')
  text = text.replace(/\bimport\s+type\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '')
  text = text.replace(/\bsatisfies\s+[A-Za-z0-9_$.|<>,\s[\]{}]+/g, '')
  text = text.replace(/\bas\s+const\b/g, '')
  text = text.replace(/:\s*[A-Za-z0-9_$.|<>,\s[\]{}]+(?=\s*[=,)])/g, '')
  text = text.replace(/\bas\s+[A-Za-z0-9_$.|<>,\s[\]{}]+/g, '')
  return text
}
