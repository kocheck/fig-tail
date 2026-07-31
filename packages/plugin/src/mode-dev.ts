import { toClassName, type MatchResult } from '@fig-tail/match'
import { collectHints } from './codegen/hints'
import { renderCodegenSections, type CodegenSection } from './codegen/render'
import { openSetupUi } from './mode-design'
import { createResolutionContext, resolveNodes, runPipeline } from './pipeline'
import { readConfig } from './storage'
import type { InspectPayload } from './shared/messages'
import { exportSubtree } from './tree/export'

/** Options derived from `figma.codegen.preferences.customSettings`. Defaults match the manifest. */
export type CodegenOptions = {
  includeLayout: boolean
  allowArbitrary: boolean
  outputNotes: boolean
  subtreeFormat: 'off' | 'html' | 'jsx' | 'outline'
}

/** Map manifest `codegenPreferences` custom settings onto `CodegenOptions`. */
export const optionsFromPreferences = (customSettings: Record<string, string> | undefined): CodegenOptions => {
  const custom = customSettings ?? {}
  const subtree = custom.subtreeFormat
  return {
    includeLayout: custom.includeLayout !== 'no',
    allowArbitrary: custom.allowArbitrary !== 'no',
    outputNotes: custom.output !== 'classes',
    subtreeFormat:
      subtree === 'html' || subtree === 'jsx' || subtree === 'outline' ? subtree : 'off',
  }
}

const LAYOUT_PROPERTIES_TO_STRIP = new Set([
  'display',
  'flex-direction',
  'align-items',
  'justify-content',
  'align-self',
  'flex-wrap',
])

/**
 * Filter results for codegen preferences without touching the matcher: when
 * `includeLayout` is off, layout utilities are dropped from the copyable
 * string (but kept, with their original confidence, for the drift/notes
 * section); when `allowArbitrary` is off, arbitrary-value classes are
 * dropped from the copyable string but still reported as drift.
 */
export const applyCodegenFilters = (results: MatchResult[], options: CodegenOptions): MatchResult[] =>
  results.map((result) => {
    if (!options.includeLayout && LAYOUT_PROPERTIES_TO_STRIP.has(result.property)) {
      return { ...result, className: null }
    }
    if (!options.allowArbitrary && result.confidence === 'arbitrary') {
      return { ...result, className: null }
    }
    return result
  })

const errorSections = (message: string): CodegenSection[] => [
  { title: 'Tailwind', language: 'PLAINTEXT', code: `/* fig-tail could not generate output: ${message} */` },
]

/** Dev Mode codegen + inspect entry points. */
export const runDevMode = () => {
  if (figma.mode === 'codegen') {
    figma.showUI(__html__, { visible: false, themeColors: true })

    figma.codegen.on('generate', async (event) => {
      try {
        const options = optionsFromPreferences(figma.codegen.preferences.customSettings)
        const config = await readConfig()
        const css = await event.node.getCSSAsync()
        const hints = collectHints(event.node)
        const output = runPipeline({ css, hints, config })
        const filteredResults = applyCodegenFilters(output.results, options)
        const className = toClassName(filteredResults)
        const sections = renderCodegenSections(filteredResults, className, output.warnings, output.tierLabel)
        const result = options.outputNotes ? sections : sections.slice(0, 1)
        const hasChildren = 'children' in event.node && event.node.children.length > 0
        if (options.subtreeFormat !== 'off' && hasChildren) {
          const tree = await exportSubtree({ format: options.subtreeFormat, deadlineMs: 2000, maxNodes: 150 })
          result.push({
            title: 'Subtree',
            language: 'PLAINTEXT',
            code: tree,
          })
        }
        return result
      } catch (error) {
        return errorSections(error instanceof Error ? error.message : String(error))
      }
    })

    figma.codegen.on('preferenceschange', async ({ propertyName }) => {
      if (propertyName === 'openSetup') {
        openSetupUi()
      }
    })
    return
  }

  // Inspect mode — full panel iframe
  figma.showUI(__html__, { width: 320, height: 480, title: 'fig-tail', themeColors: true })

  let requestId = 0
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const emptyPayload = async (selectionCount: number): Promise<InspectPayload> => {
    const config = await readConfig()
    return {
      className: '',
      warnings: [],
      results: [],
      tierLabel: config.label,
      ...(config.active?.config.tokens.unknownNamespaces.length
        ? { unknownNamespaces: config.active.config.tokens.unknownNamespaces }
        : {}),
      ...(config.active?.config.tokens.partialNamespaces.length
        ? { partialNamespaces: config.active.config.tokens.partialNamespaces }
        : {}),
      selectionCount,
      empty: true,
    }
  }

  const buildInspectPayload = async (): Promise<InspectPayload> => {
    const selection = figma.currentPage.selection
    if (selection.length === 0) {
      return emptyPayload(0)
    }
    const ctx = await createResolutionContext()
    const nodeIds = selection.map((node) => node.id)
    const resolved = await resolveNodes(nodeIds, ctx)
    const first = resolved[0]
    const tokens = ctx.config.active?.config.tokens ?? null
    if (!first?.output) {
      return {
        className: '',
        warnings: [first?.error ?? 'Could not read this layer'],
        results: [],
        tierLabel: ctx.config.label,
        ...(tokens?.unknownNamespaces.length ? { unknownNamespaces: tokens.unknownNamespaces } : {}),
        ...(tokens?.partialNamespaces.length ? { partialNamespaces: tokens.partialNamespaces } : {}),
        selectionCount: selection.length,
        empty: false,
      }
    }
    const output = first.output
    return {
      className: output.className,
      warnings: output.warnings,
      results: output.results.map((result) => ({
        property: result.property,
        className: result.className,
        confidence: result.confidence,
        ...(result.note ? { note: result.note } : {}),
      })),
      tierLabel: output.tierLabel,
      ...(output.tokens?.unknownNamespaces.length ? { unknownNamespaces: output.tokens.unknownNamespaces } : {}),
      ...(output.tokens?.partialNamespaces.length ? { partialNamespaces: output.tokens.partialNamespaces } : {}),
      selectionCount: selection.length,
      empty: false,
    }
  }

  const publishInspect = async () => {
    const thisRequest = ++requestId
    const payload = await buildInspectPayload()
    if (thisRequest !== requestId) return // a newer selection change won the race
    figma.ui.postMessage({ type: 'inspect-result', payload })
  }

  const scheduleInspect = () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void publishInspect()
    }, 120)
  }

  figma.on('selectionchange', scheduleInspect)
  void publishInspect()
}
