import type {
  PluginMessage,
  SetupUiState,
  InspectPayload,
  LintPayload,
  StampDiffPayload,
  StampApplyResult,
} from '../shared/messages'
import { storageFailureMessages } from '../shared/errors'
import { resolveSetupInput } from '../setup'

declare const parent: Window

const root = document.getElementById('root')
if (!root) {
  throw new Error('missing #root')
}

type ViewState = {
  setup: SetupUiState
  inspect: InspectPayload | null
  lint: LintPayload | null
  stamp: StampDiffPayload | null
  stampResult: StampApplyResult | null
  exportCode: string
  status: string
  statusKind: 'info' | 'warn' | 'danger' | ''
}

const state: ViewState = {
  setup: { kind: 'empty' },
  inspect: null,
  lint: null,
  stamp: null,
  stampResult: null,
  exportCode: '',
  status: '',
  statusKind: '',
}

const post = (message: PluginMessage) => {
  parent.postMessage({ pluginMessage: message }, '*')
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Copy text exactly as displayed. Prefers the Clipboard API; falls back to
 * selecting the already-rendered `sourceElementId` node and `execCommand`,
 * so the copy is always byte-identical to what is on screen without
 * creating or removing any DOM nodes (write-safety's DOM-mutation ban is
 * blanket across this package, including the UI iframe).
 */
const copyText = async (text: string, sourceElementId: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fall through to the selection-based fallback below.
  }
  const target = document.getElementById(sourceElementId)
  const selection = window.getSelection()
  if (!target || !selection) return
  const range = document.createRange()
  range.selectNodeContents(target)
  selection.removeAllRanges()
  selection.addRange(range)
  document.execCommand('copy')
  selection.removeAllRanges()
}

const renderStorageFailureBanner = (
  failures: NonNullable<InspectPayload['storageFailures']> | undefined,
  activeTier: 'document' | 'user' | null,
): string => {
  if (!failures?.length) return ''
  const messages = storageFailureMessages(failures, activeTier)
  if (messages.length === 0) return ''
  return `<ul class="banner warn">${messages.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
}

const renderStampSummary = (result: StampApplyResult | null): string => {
  if (!result) return ''
  const lines: string[] = [
    `Applied ${result.applied.length}`,
    `Skipped ${result.skipped.length}`,
    `Failed ${result.failed.length}`,
  ]
  const skipLines = result.skipped
    .slice(0, 8)
    .map((s) => `<div class="item muted">${escapeHtml(s.id)} — ${escapeHtml(s.reason)}</div>`)
    .join('')
  const failLines = result.failed
    .slice(0, 8)
    .map((f) => `<div class="item muted">${escapeHtml(f.id || '—')} — ${escapeHtml(f.error)}</div>`)
    .join('')
  return `<div class="banner ${result.failed.length ? 'warn' : 'info'}">${escapeHtml(lines.join(' · '))}</div>${skipLines}${failLines}`
}

/** Render the Inspect section: config status, class string, per-result badges, empty/multi-select states. */
const renderInspectBody = (inspect: InspectPayload | null): string => {
  if (!inspect) {
    return `<p class="muted">Inspect results appear in Dev Mode Inspect.</p>`
  }
  if (inspect.empty) {
    const storageBanner = renderStorageFailureBanner(inspect.storageFailures, inspect.activeTier ?? null)
    return `${storageBanner}<p class="muted">Select a layer to see its Tailwind classes.</p>`
  }

  const isNoConfig = inspect.tierLabel.startsWith('No Tailwind config')
  const tierBanner = `
    <div class="banner ${isNoConfig ? 'warn' : 'info'}">
      ${escapeHtml(inspect.tierLabel)}
      ${isNoConfig ? `<div class="row"><button type="button" id="inspect-add-config">Add your config</button></div>` : ''}
    </div>`

  const storageBanner = renderStorageFailureBanner(inspect.storageFailures, inspect.activeTier ?? null)

  const namespaceNotes = [
    inspect.unknownNamespaces?.length
      ? `<div class="item muted">Could not read from your config: ${escapeHtml(inspect.unknownNamespaces.join(', '))} — showing raw values for them.</div>`
      : '',
    inspect.partialNamespaces?.length
      ? `<div class="item muted">Exact Tailwind version not confirmed for: ${escapeHtml(inspect.partialNamespaces.join(', '))} — bundled defaults withheld; explicit tokens still match.</div>`
      : '',
  ]
    .filter(Boolean)
    .join('')

  const selectionNote =
    inspect.selectionCount > 1
      ? `<div class="item muted">${inspect.selectionCount} layers selected — showing the first</div>`
      : ''

  const classOut = `
    <pre class="class-out" id="inspect-class-out">${escapeHtml(inspect.className || '/* no classes */')}</pre>
    <div class="row"><button type="button" id="inspect-copy" aria-label="Copy classes">Copy classes</button></div>`

  const resultsList = inspect.results.length
    ? `<div class="list">${inspect.results
        .map(
          (r) =>
            `<div class="item"><span class="badge badge-${escapeHtml(r.confidence)}">${escapeHtml(r.confidence)}</span> <strong>${escapeHtml(r.property)}</strong>: ${escapeHtml(r.className ?? r.note ?? '—')}</div>`,
        )
        .join('')}</div>`
    : ''

  const warnings = inspect.warnings.length
    ? `<div class="list">${inspect.warnings.map((w) => `<div class="item muted">${escapeHtml(w)}</div>`).join('')}</div>`
    : ''

  return `${tierBanner}${storageBanner}${namespaceNotes}${selectionNote}${classOut}${resultsList}${warnings}`
}

const toolOutContent = (): string => {
  if (state.stampResult) {
    return [
      `Applied: ${state.stampResult.applied.length}`,
      ...state.stampResult.skipped.map((s) => `skipped ${s.id}: ${s.reason}`),
      ...state.stampResult.failed.map((f) => `failed ${f.id || '—'}: ${f.error}`),
    ].join('\n')
  }
  if (state.status) return state.status
  if (state.exportCode) return state.exportCode
  return JSON.stringify(state.lint ?? state.stamp ?? {}, null, 2)
}

const render = () => {
  const setup = state.setup
  const setupBody = (() => {
    if (setup.kind === 'empty') {
      const storageBanner = renderStorageFailureBanner(setup.storageFailures, null)
      return `${storageBanner}<p class="muted">Drop your <code>tailwind.config.js</code>/<code>.ts</code> or v4 <code>app.css</code>, plus <code>package.json</code> for exact version evidence.</p>`
    }
    if (setup.kind === 'loading') return `<p class="muted">Resolving…</p>`
    if (setup.kind === 'error') return `<p class="banner danger">${escapeHtml(setup.message)}</p>`
    if (setup.kind === 'write-warn') {
      return `<div class="banner warn">${escapeHtml(setup.label)}<ul>${setup.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>`
    }
    if (setup.kind === 'no-edit') {
      return `<div class="banner warn">${escapeHtml(setup.label)}<ul>${setup.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>`
    }
    const switchNotice =
      setup.available.document && setup.available.user
        ? `<div class="banner info">Both a shared and a personal config exist — currently using <strong>${setup.tier}</strong>.
           <div class="row"><button type="button" id="switch-source" data-target="${setup.tier === 'document' ? 'user' : 'document'}">
             Switch to ${setup.tier === 'document' ? 'personal' : 'shared'} config
           </button></div></div>`
        : ''
    const storageBanner = renderStorageFailureBanner(setup.storageFailures, setup.tier)
    const warnings = setup.warnings.length
      ? `<ul class="banner warn">${setup.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
      : ''
    return `<div class="banner info"><strong>${escapeHtml(setup.label)}</strong><ul>${setup.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>${switchNotice}${storageBanner}${warnings}`
  })()

  const inspectBody = renderInspectBody(state.inspect)
  const stampSummary = renderStampSummary(state.stampResult)
  const statusBanner =
    state.status && state.statusKind
      ? `<div class="banner ${state.statusKind === 'info' ? 'info' : state.statusKind}">${escapeHtml(state.status)}</div>`
      : ''

  root.innerHTML = `
    <main>
      <h1>fig-tail</h1>
      <section>
        <h2>Setup</h2>
        ${setupBody}
        <div class="row">
          <label class="file" tabindex="0" aria-label="Choose Tailwind config file">
            Config file
            <input id="config-file" type="file" accept=".js,.cjs,.mjs,.ts,.css" />
          </label>
          <label class="file" tabindex="0" aria-label="Choose package.json">
            package.json
            <input id="pkg-file" type="file" accept=".json,application/json" />
          </label>
          <button type="button" class="primary" id="resolve" aria-label="Resolve config">Resolve</button>
          <button type="button" id="save-doc" aria-label="Apply to file">Apply to file</button>
          <button type="button" id="save-personal" aria-label="Save personally">Save personally</button>
          <button type="button" id="remove-doc" aria-label="Remove file config">Remove file config</button>
          <button type="button" id="remove-personal" aria-label="Remove personal config">Remove personal config</button>
        </div>
        <p class="muted" id="file-names"></p>
      </section>
      <section>
        <h2>Inspect</h2>
        ${inspectBody}
      </section>
      <section>
        <h2>Tools</h2>
        <div class="row">
          <button type="button" id="lint" aria-label="Run drift linter">Lint drift</button>
          <button type="button" id="export" aria-label="Export subtree">Export subtree</button>
          <button type="button" id="stamp-prep" aria-label="Prepare stamp diff">Stamp dry-run</button>
          <button type="button" id="stamp-apply" aria-label="Apply stamp">Apply stamp</button>
        </div>
        ${statusBanner}
        ${stampSummary}
        <pre class="class-out" id="tool-out">${escapeHtml(toolOutContent())}</pre>
      </section>
    </main>
  `

  let configText = ''
  let configName = 'tailwind.config.js'
  let packageJsonText: string | undefined

  const configInput = document.getElementById('config-file') as HTMLInputElement | null
  const pkgInput = document.getElementById('pkg-file') as HTMLInputElement | null
  const names = document.getElementById('file-names')

  configInput?.addEventListener('change', async () => {
    const file = configInput.files?.[0]
    if (!file) return
    configName = file.name
    configText = await file.text()
    if (names) names.textContent = `Config: ${configName}`
  })
  pkgInput?.addEventListener('change', async () => {
    const file = pkgInput.files?.[0]
    if (!file) return
    packageJsonText = await file.text()
    if (names) names.textContent = `${names.textContent ?? ''} · package.json`
  })

  document.getElementById('resolve')?.addEventListener('click', async () => {
    if (!configText) {
      state.setup = { kind: 'error', message: 'Choose a config file first' }
      render()
      return
    }
    state.setup = { kind: 'loading' }
    render()
    const resolved = await resolveSetupInput({
      configText,
      configName,
      ...(packageJsonText !== undefined ? { packageJsonText } : {}),
    })
    if (!resolved.ok || !resolved.tokens || !resolved.provenance) {
      state.setup = { kind: 'error', message: resolved.message }
      render()
      return
    }
    ;(window as unknown as { __figTailPending?: typeof resolved }).__figTailPending = resolved
    state.setup = {
      kind: 'configured',
      tier: 'document',
      label: 'Resolved — choose where to save',
      details: [resolved.message, 'Raw source is discarded after resolve'],
      warnings: resolved.diagnostics.map((d) => d.message),
      available: { document: false, user: false },
      preferred: 'document',
      overridden: false,
      canWriteDocument: true,
    }
    render()
  })

  const pendingPayload = () => {
    const pending = (window as unknown as { __figTailPending?: Awaited<ReturnType<typeof resolveSetupInput>> })
      .__figTailPending
    if (!pending?.tokens || !pending.provenance) return null
    return pending
  }

  document.getElementById('save-doc')?.addEventListener('click', () => {
    const pending = pendingPayload()
    if (!pending?.tokens || !pending.provenance) return
    post({
      type: 'save-resolved',
      target: 'document',
      tokens: pending.tokens,
      provenance: pending.provenance,
      diagnostics: pending.diagnostics,
      warnings: pending.warnings,
    })
  })
  document.getElementById('save-personal')?.addEventListener('click', () => {
    const pending = pendingPayload()
    if (!pending?.tokens || !pending.provenance) return
    post({
      type: 'save-resolved',
      target: 'user',
      tokens: pending.tokens,
      provenance: pending.provenance,
      diagnostics: pending.diagnostics,
      warnings: pending.warnings,
    })
  })
  document.getElementById('remove-doc')?.addEventListener('click', () => post({ type: 'remove-config', target: 'document' }))
  document
    .getElementById('remove-personal')
    ?.addEventListener('click', () => post({ type: 'remove-config', target: 'user' }))
  document.getElementById('switch-source')?.addEventListener('click', (event) => {
    const target = (event.currentTarget as HTMLElement).dataset.target
    if (target === 'document' || target === 'user') {
      post({ type: 'prefer-source', preferred: target })
    }
  })
  document.getElementById('lint')?.addEventListener('click', () => post({ type: 'run-lint' }))
  document.getElementById('export')?.addEventListener('click', () =>
    post({ type: 'export-subtree', format: 'html' }),
  )
  document.getElementById('stamp-prep')?.addEventListener('click', () => post({ type: 'stamp-prepare' }))
  document.getElementById('stamp-apply')?.addEventListener('click', () => {
    const stamp = state.stamp
    if (!stamp) {
      post({ type: 'stamp-prepare' })
      return
    }
    const applicable = stamp.changes.filter((c) => c.status === 'high' || c.status === 'medium')
    if (applicable.length === 0) {
      state.status = 'No appliable stamp rows (conflicts are blocked)'
      state.statusKind = 'warn'
      render()
      return
    }
    const selectedIds = applicable.map((c) => c.variableId)
    const overwriteIds = applicable.filter((c) => c.overwriteRequired).map((c) => c.variableId)
    const confirmed = window.confirm(
      `Apply WEB code syntax to ${selectedIds.length} variable(s)? Conflicts are skipped. Use Figma undo to reverse.`,
    )
    if (!confirmed) return
    post({ type: 'stamp-apply', selectedIds, overwriteIds })
  })
  document.getElementById('inspect-copy')?.addEventListener('click', () => {
    void copyText(state.inspect?.className || '', 'inspect-class-out')
  })
  document.getElementById('inspect-add-config')?.addEventListener('click', () => post({ type: 'open-setup' }))
}

onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as PluginMessage | { type: string; [key: string]: unknown } | undefined
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return
  if (msg.type === 'setup-state') {
    state.setup = (msg as Extract<PluginMessage, { type: 'setup-state' }>).state
    state.status = ''
    state.statusKind = ''
    render()
    return
  }
  if (msg.type === 'inspect-result') {
    state.inspect = (msg as Extract<PluginMessage, { type: 'inspect-result' }>).payload
    render()
    return
  }
  if (msg.type === 'lint-result') {
    state.lint = (msg as Extract<PluginMessage, { type: 'lint-result' }>).payload
    const skipNote =
      state.lint.resolutionFailures > 0
        ? ` · skipped ${state.lint.resolutionFailures} layers`
        : ''
    state.status = `${state.lint.findings.length} findings · ${state.lint.visited} nodes · ${state.lint.durationMs}ms${state.lint.truncated ? ' (truncated)' : ''}${skipNote}`
    state.statusKind = state.lint.resolutionFailures > 0 || state.lint.truncated ? 'warn' : 'info'
    state.exportCode = state.lint.markdown
    state.stampResult = null
    render()
    return
  }
  if (msg.type === 'export-result') {
    state.exportCode = (msg as Extract<PluginMessage, { type: 'export-result' }>).code
    state.status = ''
    state.statusKind = ''
    state.stampResult = null
    render()
    return
  }
  if (msg.type === 'stamp-diff') {
    state.stamp = (msg as Extract<PluginMessage, { type: 'stamp-diff' }>).payload
    state.stampResult = null
    state.status = `${state.stamp.changes.length} stamp changes`
    state.statusKind = 'info'
    render()
    return
  }
  if (msg.type === 'stamp-result') {
    state.stampResult = (msg as Extract<PluginMessage, { type: 'stamp-result' }>).payload
    const r = state.stampResult
    state.status = `Updated ${r.applied.length}; skipped ${r.skipped.length}; failed ${r.failed.length}. Undo with ⌘Z if needed.`
    state.statusKind = r.failed.length ? 'warn' : 'info'
    render()
    return
  }
  if (msg.type === 'operation-error') {
    const err = msg as Extract<PluginMessage, { type: 'operation-error' }>
    state.status = `${err.operation} failed: ${err.message}`
    state.statusKind = 'danger'
    render()
    return
  }
  if (msg.type === 'resolve-result') {
    const result = msg as Extract<PluginMessage, { type: 'resolve-result' }>
    state.status = result.message
    if (result.ok) {
      state.statusKind = 'info'
    } else if (result.reason === 'quota') {
      state.statusKind = 'warn'
      if (state.setup.kind !== 'write-warn' && state.setup.kind !== 'no-edit') {
        state.setup = {
          kind: 'write-warn',
          label: 'Could not save — storage quota exceeded',
          details: [result.message, 'Try saving personally, or use a smaller config.'],
        }
      }
    } else if (result.reason === 'validation' || result.reason === 'write-failed') {
      state.statusKind = 'danger'
      if (state.setup.kind !== 'error' && state.setup.kind !== 'no-edit') {
        state.setup = { kind: 'error', message: result.message }
      }
    } else {
      state.statusKind = 'danger'
    }
    render()
  }
}

render()
post({ type: 'ready' })
