import type { PluginMessage } from './shared/messages'
import { buildStoredConfig, clearConfig, readConfig, setPreferredSource, writeConfig } from './storage'
import { runLint } from './lint/run-lint'
import { exportSubtree } from './export/subtree'
import { applyStamp, prepareStampDiff } from './stamp/stamp'

/** Open the setup UI from design or codegen preferences. */
export const openSetupUi = () => {
  figma.showUI(__html__, { width: 400, height: 520, title: 'fig-tail setup', themeColors: true })
  void publishSetupState()
}

const publishSetupState = async () => {
  const result = await readConfig()
  const canWriteDocument = figma.editorType === 'figma'
  if (!result.active) {
    figma.ui.postMessage({ type: 'setup-state', state: { kind: 'empty' } } satisfies PluginMessage)
    return
  }
  const { config, tier } = result.active
  const details = [`Saved ${config.storedAt}`, `Defaults: ${config.tokens.source.defaults.status}`]
  const warnings = config.resolution.unresolved.map((d) => d.message)
  figma.ui.postMessage({
    type: 'setup-state',
    state: {
      kind: 'configured',
      label: result.label,
      tier,
      details,
      warnings,
      available: result.available,
      preferred: result.preferred,
      overridden: result.overridden,
      canWriteDocument,
    },
  } satisfies PluginMessage)
}

/** Design-editor mode: setup + stamp apply. */
export const runDesignMode = () => {
  openSetupUi()
}

/** Handle UI messages shared across modes. */
export const handleUiMessage = async (msg: PluginMessage) => {
  if (msg.type === 'ready') {
    await publishSetupState()
    return
  }
  if (msg.type === 'open-setup') {
    openSetupUi()
    return
  }
  if (msg.type === 'save-resolved') {
    const draft = buildStoredConfig(msg.tokens, msg.provenance, msg.diagnostics, msg.warnings)
    const result = await writeConfig(draft, { target: msg.target })
    if (!result.ok && result.reason === 'no-edit-access') {
      const availability = await readConfig()
      figma.ui.postMessage({
        type: 'setup-state',
        state: {
          kind: 'no-edit',
          label: 'Saving to this file needs edit access',
          details: [...result.errors, 'Save to your personal settings instead — it needs no edit access.'],
          available: availability.available,
        },
      } satisfies PluginMessage)
      return
    }
    figma.ui.postMessage({
      type: 'resolve-result',
      ok: result.ok,
      message: result.ok ? `Saved to ${result.writtenTo}` : result.errors.join('; '),
    } satisfies PluginMessage)
    await publishSetupState()
    return
  }
  if (msg.type === 'remove-config') {
    await clearConfig(msg.target)
    await publishSetupState()
    return
  }
  if (msg.type === 'prefer-source') {
    await setPreferredSource(msg.preferred)
    await publishSetupState()
    return
  }
  if (msg.type === 'run-lint') {
    const payload = await runLint()
    figma.ui.postMessage({ type: 'lint-result', payload } satisfies PluginMessage)
    return
  }
  if (msg.type === 'export-subtree') {
    const code = await exportSubtree({ format: msg.format ?? 'html' })
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
    const count = msg.selectedIds.length
    if (count === 0) {
      figma.notify('Select at least one row to apply')
      return
    }
    const { applied, skipped } = await applyStamp({
      selectedIds: msg.selectedIds,
      overwriteIds: msg.overwriteIds,
    })
    figma.notify(`Updated ${applied} variable(s); skipped ${skipped}. Undo with ⌘Z if needed.`)
    await publishSetupState()
  }
}
