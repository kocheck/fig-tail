import type { PluginMessage } from './shared/messages'
import { messageOf, meaningfulStorageFailures } from './shared/errors'
import { buildStoredConfig, clearConfig, readConfig, setPreferredSource, writeConfig } from './storage'
import type { WriteResult } from './storage-types'
import { runLint } from './lint/run-lint'
import { exportSubtree } from './export/subtree'
import { applyStamp, prepareStampDiff } from './stamp/stamp'

type WriteFailureReason = Extract<WriteResult, { ok: false }>['reason']

/** Open the setup UI from design or codegen preferences. */
export const openSetupUi = () => {
  figma.showUI(__html__, { width: 400, height: 520, title: 'fig-tail setup', themeColors: true })
  void publishSetupState()
}

const publishSetupState = async () => {
  const result = await readConfig()
  const canWriteDocument = figma.editorType === 'figma'
  const failures = meaningfulStorageFailures(result.failures)
  if (!result.active) {
    figma.ui.postMessage({
      type: 'setup-state',
      state: {
        kind: 'empty',
        ...(failures.length ? { storageFailures: failures } : {}),
      },
    } satisfies PluginMessage)
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
      ...(failures.length ? { storageFailures: failures } : {}),
    },
  } satisfies PluginMessage)
}

/** Design-editor mode: setup + stamp apply. */
export const runDesignMode = () => {
  openSetupUi()
}

const postResolveResult = (ok: boolean, message: string, reason?: WriteFailureReason) => {
  figma.ui.postMessage({
    type: 'resolve-result',
    ok,
    message,
    ...(reason ? { reason } : {}),
  } satisfies PluginMessage)
}

/** Handle UI messages shared across modes. Never throws across the iframe boundary. */
export const handleUiMessage = async (msg: PluginMessage) => {
  try {
    await handleUiMessageInner(msg)
  } catch (error) {
    const operation = typeof msg === 'object' && msg && 'type' in msg ? String(msg.type) : 'unknown'
    figma.ui.postMessage({
      type: 'operation-error',
      operation,
      message: messageOf(error),
    } satisfies PluginMessage)
  }
}

const handleUiMessageInner = async (msg: PluginMessage) => {
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
    if (!result.ok && result.reason === 'quota') {
      figma.ui.postMessage({
        type: 'setup-state',
        state: {
          kind: 'write-warn',
          label: 'Could not save — storage quota exceeded',
          details: [
            ...result.errors,
            'Try saving personally, or use a smaller config.',
          ],
        },
      } satisfies PluginMessage)
      postResolveResult(false, result.errors.join('; ') || 'Storage quota exceeded', 'quota')
      return
    }
    if (!result.ok && (result.reason === 'validation' || result.reason === 'write-failed')) {
      figma.ui.postMessage({
        type: 'setup-state',
        state: {
          kind: 'error',
          message: result.errors.slice(0, 3).join('; ') || `Save failed (${result.reason})`,
        },
      } satisfies PluginMessage)
      postResolveResult(false, result.errors.join('; ') || `Save failed (${result.reason})`, result.reason)
      return
    }
    postResolveResult(true, result.ok ? `Saved to ${result.writtenTo}` : result.errors.join('; '))
    await publishSetupState()
    return
  }
  if (msg.type === 'remove-config') {
    const result = await clearConfig(msg.target)
    if (!result.ok) {
      if (result.reason === 'quota') {
        figma.ui.postMessage({
          type: 'setup-state',
          state: {
            kind: 'write-warn',
            label: 'Could not remove config',
            details: result.errors,
          },
        } satisfies PluginMessage)
      } else if (result.reason === 'no-edit-access') {
        figma.ui.postMessage({
          type: 'setup-state',
          state: {
            kind: 'no-edit',
            label: 'Removing the shared config needs edit access',
            details: result.errors,
            available: (await readConfig()).available,
          },
        } satisfies PluginMessage)
      } else {
        figma.ui.postMessage({
          type: 'setup-state',
          state: {
            kind: 'error',
            message: result.errors.slice(0, 3).join('; ') || `Remove failed (${result.reason})`,
          },
        } satisfies PluginMessage)
      }
      postResolveResult(false, result.errors.join('; ') || `Remove failed (${result.reason})`, result.reason)
      return
    }
    postResolveResult(true, `Removed ${msg.target} config`)
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
      figma.ui.postMessage({
        type: 'stamp-result',
        payload: { applied: [], skipped: [], failed: [{ id: '', error: 'design-editor-only' }] },
      } satisfies PluginMessage)
      return
    }
    const count = msg.selectedIds.length
    if (count === 0) {
      figma.notify('Select at least one row to apply')
      figma.ui.postMessage({
        type: 'stamp-result',
        payload: { applied: [], skipped: [], failed: [] },
      } satisfies PluginMessage)
      return
    }
    const payload = await applyStamp({
      selectedIds: msg.selectedIds,
      overwriteIds: msg.overwriteIds,
    })
    const applied = payload.applied.length
    const skipped = payload.skipped.length
    const failed = payload.failed.length
    figma.notify(
      `Updated ${applied}; skipped ${skipped}${failed ? `; failed ${failed}` : ''}. Undo with ⌘Z if needed.`,
    )
    figma.ui.postMessage({ type: 'stamp-result', payload } satisfies PluginMessage)
    await publishSetupState()
  }
}
