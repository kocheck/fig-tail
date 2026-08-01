/* Throwaway platform spike — not production code. Plan 000. */

const STORAGE_META_KEY = 'ft.spike.meta'
const STORAGE_CHUNK_0 = 'ft.spike.chunk.0'
const STORAGE_CHUNK_1 = 'ft.spike.chunk.1'

const log = (label, value) => {
  console.log(`[fig-tail-spike] ${label}`, value)
}

const sortedCss = (css) => {
  const keys = Object.keys(css).sort()
  const out = {}
  for (const key of keys) {
    out[key] = css[key]
  }
  return out
}

const captureSelectionCss = async () => {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    return { error: 'Select a node first' }
  }
  const node = selection[0]
  if (!('getCSSAsync' in node) || typeof node.getCSSAsync !== 'function') {
    return { error: `Node ${node.type} has no getCSSAsync` }
  }
  const css = await node.getCSSAsync()
  return {
    name: node.name,
    id: node.id,
    editorType: figma.editorType,
    mode: figma.mode,
    css: sortedCss(css),
  }
}

const writeSpikeStorage = () => {
  const chunk0 = JSON.stringify({ part: 0, payload: 'a'.repeat(2000) })
  const chunk1 = JSON.stringify({ part: 1, payload: 'b'.repeat(2000) })
  figma.root.setPluginData(STORAGE_CHUNK_0, chunk0)
  figma.root.setPluginData(STORAGE_CHUNK_1, chunk1)
  figma.root.setPluginData(
    STORAGE_META_KEY,
    JSON.stringify({
      chunks: 2,
      writtenAt: new Date().toISOString(),
      pluginId: 'fig-tail-platform-spike',
    }),
  )
  return {
    chunk0Bytes: chunk0.length,
    chunk1Bytes: chunk1.length,
  }
}

const readSpikeStorage = () => {
  return {
    meta: figma.root.getPluginData(STORAGE_META_KEY),
    chunk0: figma.root.getPluginData(STORAGE_CHUNK_0),
    chunk1: figma.root.getPluginData(STORAGE_CHUNK_1),
  }
}

const snapshotVariable = async (variableId) => {
  const variable = await figma.variables.getVariableByIdAsync(variableId)
  if (!variable) {
    return null
  }
  return {
    id: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType,
    valuesByMode: variable.valuesByMode,
    scopes: variable.scopes,
    description: variable.description,
    codeSyntax: { ...variable.codeSyntax },
  }
}

const runWriteMatrix = async () => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  let collection = collections[0]
  if (!collection) {
    collection = figma.variables.createVariableCollection('fig-tail-spike')
  }
  const modeId = collection.modes[0].modeId
  let variable = (await figma.variables.getLocalVariablesAsync()).find(
    (item) => item.name === 'fig-tail/spike-color',
  )
  if (!variable) {
    variable = figma.variables.createVariable(
      'fig-tail/spike-color',
      collection,
      'COLOR',
    )
    variable.setValueForMode(modeId, {
      r: 0.23,
      g: 0.51,
      b: 0.96,
      a: 1,
    })
  }

  const before = await snapshotVariable(variable.id)
  const results = {
    editorType: figma.editorType,
    mode: figma.mode,
    before,
    designWrite: null,
    designRead: null,
    error: null,
  }

  try {
    variable.setVariableCodeSyntax('WEB', 'brand-500')
    results.designWrite = 'ok'
    results.designRead = await snapshotVariable(variable.id)
    if (before && before.codeSyntax && before.codeSyntax.WEB) {
      variable.setVariableCodeSyntax('WEB', before.codeSyntax.WEB)
    } else {
      variable.removeVariableCodeSyntax('WEB')
    }
    results.afterRestore = await snapshotVariable(variable.id)
  } catch (error) {
    results.error = String(error)
  }

  return results
}

figma.codegen.on('generate', async () => {
  const capture = await captureSelectionCss()
  return [
    {
      language: 'PLAINTEXT',
      code: JSON.stringify(
        {
          route: 'codegen',
          editorType: figma.editorType,
          mode: figma.mode,
          capture,
        },
        null,
        2,
      ),
      title: 'Spike capture',
    },
  ]
})

figma.codegen.on('preferenceschange', async ({ propertyName }) => {
  if (propertyName !== 'openSpikeSetup') {
    return
  }
  figma.showUI(__html__, { width: 360, height: 420, title: 'fig-tail spike' })
})

if (figma.editorType === 'figma') {
  figma.showUI(__html__, { width: 360, height: 420, title: 'fig-tail spike' })
} else if (figma.mode === 'inspect') {
  figma.showUI(__html__, { width: 320, height: 480, title: 'fig-tail spike inspect' })
}

figma.ui.onmessage = async (msg) => {
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
    return
  }

  if (msg.type === 'route-info') {
    figma.ui.postMessage({
      type: 'route-info',
      editorType: figma.editorType,
      mode: figma.mode,
    })
    return
  }

  if (msg.type === 'capture-css') {
    const capture = await captureSelectionCss()
    log('css-capture', capture)
    figma.ui.postMessage({ type: 'capture-css', capture })
    return
  }

  if (msg.type === 'write-storage') {
    const written = writeSpikeStorage()
    figma.ui.postMessage({ type: 'write-storage', written })
    return
  }

  if (msg.type === 'read-storage') {
    figma.ui.postMessage({ type: 'read-storage', data: readSpikeStorage() })
    return
  }

  if (msg.type === 'write-matrix') {
    const matrix = await runWriteMatrix()
    log('write-matrix', matrix)
    figma.ui.postMessage({ type: 'write-matrix', matrix })
  }
}
