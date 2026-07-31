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
    const warnings =
      setup.kind === 'partial'
        ? `<ul class="banner warn">${setup.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
        : ''
    return `<div class="banner"><strong>${escapeHtml(setup.label)}</strong><ul>${setup.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>${warnings}`
  })()

  const inspectBody = state.inspect
    ? `<div class="banner">${escapeHtml(state.inspect.tierLabel)}</div>
       <pre class="class-out">${escapeHtml(state.inspect.className || '/* no classes */')}</pre>
       <div class="list">${state.inspect.warnings.map((w) => `<div class="item muted">${escapeHtml(w)}</div>`).join('')}</div>`
    : `<p class="muted">Inspect results appear in Dev Mode Inspect.</p>`

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
          <button type="button" id="save-doc" aria-label="Save on this file">Save on file</button>
          <button type="button" id="save-personal" aria-label="Save personally">Save personal</button>
          <button type="button" id="remove-doc" aria-label="Remove file config">Remove file</button>
          <button type="button" id="remove-personal" aria-label="Remove personal config">Remove personal</button>
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
      kind: resolved.diagnostics.length ? 'partial' : 'ready',
      label: 'Resolved — choose where to save',
      details: [resolved.message, 'Raw source is discarded after resolve'],
      warnings: resolved.diagnostics.map((d) => d.message),
      canWriteDocument: true,
    }
    render()
  })

  document.getElementById('save-doc')?.addEventListener('click', () => {
    const pending = (window as unknown as { __figTailPending?: Awaited<ReturnType<typeof resolveSetupInput>> }).__figTailPending
    if (!pending?.tokens || !pending.provenance) return
    post({
      type: 'save-config',
      tier: 1,
      // extended fields consumed by sandbox handler via closure replacement below
    } as PluginMessage)
    // Send resolved payload through a dedicated path
    parent.postMessage(
      {
        pluginMessage: {
          type: 'save-resolved',
          tier: 1,
          tokens: pending.tokens,
          provenance: pending.provenance,
          diagnostics: pending.diagnostics,
          warnings: pending.warnings,
        },
      },
      '*',
    )
  })
  document.getElementById('save-personal')?.addEventListener('click', () => {
    const pending = (window as unknown as { __figTailPending?: Awaited<ReturnType<typeof resolveSetupInput>> }).__figTailPending
    if (!pending?.tokens || !pending.provenance) return
    parent.postMessage(
      {
        pluginMessage: {
          type: 'save-resolved',
          tier: 2,
          tokens: pending.tokens,
          provenance: pending.provenance,
          diagnostics: pending.diagnostics,
          warnings: pending.warnings,
        },
      },
      '*',
    )
  })
  document.getElementById('remove-doc')?.addEventListener('click', () => post({ type: 'remove-config', tier: 1 }))
  document.getElementById('remove-personal')?.addEventListener('click', () => post({ type: 'remove-config', tier: 2 }))
  document.getElementById('lint')?.addEventListener('click', () => post({ type: 'run-lint' }))
  document.getElementById('export')?.addEventListener('click', () => post({ type: 'export-subtree' }))
  document.getElementById('stamp-prep')?.addEventListener('click', () => post({ type: 'stamp-prepare' }))
  document.getElementById('stamp-apply')?.addEventListener('click', () => post({ type: 'stamp-apply' }))
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

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
    state.status = `${state.lint.findings.length} findings${state.lint.truncated ? ' (truncated)' : ''}`
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
