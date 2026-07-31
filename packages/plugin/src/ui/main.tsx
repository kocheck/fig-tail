import type { PluginMessage, SetupUiState, InspectPayload, LintPayload, StampDiffPayload } from '../shared/messages'
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
  exportCode: string
  status: string
}

const state: ViewState = {
  setup: { kind: 'empty' },
  inspect: null,
  lint: null,
  stamp: null,
  exportCode: '',
  status: '',
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

/** Render the Inspect section: config status, class string, per-result badges, empty/multi-select states. */
const renderInspectBody = (inspect: InspectPayload | null): string => {
  if (!inspect) {
    return `<p class="muted">Inspect results appear in Dev Mode Inspect.</p>`
  }
  if (inspect.empty) {
    return `<p class="muted">Select a layer to see its Tailwind classes.</p>`
  }

  const isNoConfig = inspect.tierLabel.startsWith('No Tailwind config')
  const tierBanner = `
    <div class="banner${isNoConfig ? ' warn' : ''}">
      ${escapeHtml(inspect.tierLabel)}
      ${isNoConfig ? `<div class="row"><button type="button" id="inspect-add-config">Add your config</button></div>` : ''}
    </div>`

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

  return `${tierBanner}${namespaceNotes}${selectionNote}${classOut}${resultsList}${warnings}`
}

const render = () => {
  const setup = state.setup
  const setupBody = (() => {
    if (setup.kind === 'empty') {
      return `<p class="muted">Drop your <code>tailwind.config.js</code>/<code>.ts</code> or v4 <code>app.css</code>, plus <code>package.json</code> for exact version evidence.</p>`
    }
    if (setup.kind === 'loading') return `<p>Resolving…</p>`
    if (setup.kind === 'error') return `<p class="banner warn">${escapeHtml(setup.message)}</p>`
    if (setup.kind === 'no-edit') {
      return `<div class="banner">${escapeHtml(setup.label)}<ul>${setup.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>`
    }
    const switchNotice =
      setup.available.document && setup.available.user
        ? `<div class="banner">Both a shared and a personal config exist — currently using <strong>${setup.tier}</strong>.
           <button type="button" id="switch-source" data-target="${setup.tier === 'document' ? 'user' : 'document'}">
             Switch to ${setup.tier === 'document' ? 'personal' : 'shared'} config
           </button></div>`
        : ''
    const warnings = setup.warnings.length
      ? `<ul class="banner warn">${setup.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
      : ''
    return `<div class="banner"><strong>${escapeHtml(setup.label)}</strong><ul>${setup.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>${switchNotice}${warnings}`
  })()

  const inspectBody = renderInspectBody(state.inspect)

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
        <pre class="class-out" id="tool-out">${escapeHtml(state.status || state.exportCode || JSON.stringify(state.lint ?? state.stamp ?? {}, null, 2))}</pre>
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
    state.status = `${state.lint.findings.length} findings · ${state.lint.visited} nodes · ${state.lint.durationMs}ms${state.lint.truncated ? ' (truncated)' : ''}`
    state.exportCode = state.lint.markdown
    render()
    return
  }
  if (msg.type === 'export-result') {
    state.exportCode = (msg as Extract<PluginMessage, { type: 'export-result' }>).code
    state.status = ''
    render()
    return
  }
  if (msg.type === 'stamp-diff') {
    state.stamp = (msg as Extract<PluginMessage, { type: 'stamp-diff' }>).payload
    state.status = `${state.stamp.changes.length} stamp changes`
    render()
    return
  }
  if (msg.type === 'resolve-result') {
    state.status = (msg as Extract<PluginMessage, { type: 'resolve-result' }>).message
    render()
  }
}

render()
post({ type: 'ready' })
