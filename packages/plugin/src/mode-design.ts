import type { PluginMessage } from './shared/messages'
import { readConfig, removeConfig, writeDocumentConfig, writePersonalConfig } from './storage'
import { runLint } from './lint/run-lint'
import { exportSubtree } from './export/subtree'
import { applyStamp, prepareStampDiff } from './stamp/stamp'
import type { ConfigProvenance, TokenSet } from '@fig-tail/theme'
import type { PersistedDiagnostic } from './storage-types'

type SaveResolvedMessage = {
  type: 'save-resolved'
  tier: 1 | 2
  tokens: TokenSet
  provenance: ConfigProvenance
  diagnostics: PersistedDiagnostic[]
  warnings: string[]
}

type UiInbound = PluginMessage | SaveResolvedMessage

/** Open the setup UI from design or codegen preferences. */
export const openSetupUi = () => {
  figma.showUI(__html__, { width: 400, height: 520, title: 'fig-tail setup' })
  void publishSetupState()
}

const publishSetupState = async () => {
  const config = await readConfig()
  const canWriteDocument = figma.editorType === 'figma'
  if (config.tier === 3) {
    figma.ui.postMessage({
      type: 'setup-state',
      state: { kind: 'empty' },
    } satisfies PluginMessage)
    return
  }
  const details = [
    `Saved ${config.config.savedAt}`,
    `Defaults: ${config.config.tokens.source.defaults.status}`,
  ]
  if (config.config.diagnostics.length) {
    figma.ui.postMessage({
      type: 'setup-state',
      state: {
        kind: 'partial',
        label: config.label,
        details,
        warnings: config.config.diagnostics.map((d) => d.message),
        canWriteDocument,
      },
    } satisfies PluginMessage)
    return
  }
  figma.ui.postMessage({
    type: 'setup-state',
    state: {
      kind: 'ready',
      label: config.label,
      details,
      canWriteDocument,
    },
  } satisfies PluginMessage)
}

/** Design-editor mode: setup + stamp apply. */
export const runDesignMode = () => {
  openSetupUi()
}

/** Handle UI messages shared across modes. */
export const handleUiMessage = async (msg: UiInbound) => {
  if (msg.type === 'ready') {
    await publishSetupState()
    return
  }
  if (msg.type === 'open-setup') {
    openSetupUi()
    return
  }
  if (msg.type === 'save-resolved') {
    const result =
      msg.tier === 1
        ? writeDocumentConfig(msg.tokens, msg.provenance, msg.diagnostics, msg.warnings)
        : await writePersonalConfig(msg.tokens, msg.provenance, msg.diagnostics, msg.warnings)
    figma.ui.postMessage({
      type: 'resolve-result',
      ok: result.ok,
      message: result.ok ? `Saved (${result.bytes} bytes, ${result.chunks} chunks)` : result.error,
    } satisfies PluginMessage)
    await publishSetupState()
    return
  }
  if (msg.type === 'save-config') {
    figma.ui.postMessage({
      type: 'resolve-result',
      ok: false,
      message: 'Resolve in the UI, then save',
    } satisfies PluginMessage)
    return
  }
  if (msg.type === 'remove-config') {
    await removeConfig(msg.tier)
    await publishSetupState()
    return
  }
  if (msg.type === 'run-lint') {
    const payload = await runLint()
    figma.ui.postMessage({ type: 'lint-result', payload } satisfies PluginMessage)
    return
  }
  if (msg.type === 'export-subtree') {
    const code = await exportSubtree()
    figma.ui.postMessage({ type: 'export-result', code } satisfies PluginMessage)
    return
  }
  if (msg.type === 'stamp-prepare') {
    const payload = await prepareStampDiff()
    figma.ui.postMessage({ type: 'stamp-diff', payload } satisfies PluginMessage)
    return
  }
  if (msg.type === 'stamp-apply') {
    if (figma.editorType !== 'figma') {
      figma.notify('Stamping can only apply in the design editor')
      return
    }
    await applyStamp()
    figma.notify('Code syntax updated')
  }
}
