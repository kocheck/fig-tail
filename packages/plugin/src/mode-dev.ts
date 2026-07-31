import { readConfig } from './storage'
import { collectHints, runPipeline } from './pipeline'
import { openSetupUi } from './mode-design'

/** Dev Mode codegen + inspect entry points. */
export const runDevMode = () => {
  if (figma.mode === 'codegen') {
    figma.showUI(__html__, { visible: false })

    figma.codegen.on('generate', async () => {
      const selection = figma.currentPage.selection[0]
      if (!selection) {
        return [
          {
            language: 'PLAINTEXT',
            code: '/* Select a layer */',
            title: 'Tailwind',
          },
        ]
      }
      if (!('getCSSAsync' in selection) || typeof selection.getCSSAsync !== 'function') {
        return [
          {
            language: 'PLAINTEXT',
            code: '/* Node has no CSS */',
            title: 'Tailwind',
          },
        ]
      }
      const css = await selection.getCSSAsync()
      const config = await readConfig()
      const hints = collectHints(selection)
      const output = runPipeline({ css, hints, config })
      const banner = [`/* ${output.tierLabel} */`, ...output.warnings.map((w) => `/* ${w} */`)]
        .join('\n')
      return [
        {
          language: 'PLAINTEXT',
          code: `${banner}\n${output.className || '/* no classes */'}`,
          title: 'Tailwind',
        },
      ]
    })

    figma.codegen.on('preferenceschange', async ({ propertyName }) => {
      if (propertyName === 'openSetup') {
        openSetupUi()
      }
    })
    return
  }

  // Inspect mode — full panel iframe
  figma.showUI(__html__, { width: 320, height: 480, title: 'fig-tail' })
  const publishInspect = async () => {
    const selection = figma.currentPage.selection[0]
    if (!selection || !('getCSSAsync' in selection)) {
      figma.ui.postMessage({
        type: 'inspect-result',
        payload: {
          className: '',
          warnings: ['Select a layer'],
          results: [],
          tierLabel: '',
        },
      })
      return
    }
    const css = await selection.getCSSAsync()
    const config = await readConfig()
    const hints = collectHints(selection)
    const output = runPipeline({ css, hints, config })
    figma.ui.postMessage({
      type: 'inspect-result',
      payload: {
        className: output.className,
        warnings: [output.tierLabel, ...output.warnings],
        results: output.results.map((r) => ({
          property: r.property,
          className: r.className,
          confidence: r.confidence,
          note: r.note,
        })),
        tierLabel: output.tierLabel,
      },
    })
  }
  figma.on('selectionchange', () => {
    void publishInspect()
  })
  void publishInspect()
}
