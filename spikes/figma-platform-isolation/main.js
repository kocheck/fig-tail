/* Disposable second-plugin-ID reader for plan 000 task 4. */

const KEYS = ['ft.spike.meta', 'ft.spike.chunk.0', 'ft.spike.chunk.1']

const data = {}
for (const key of KEYS) {
  data[key] = figma.root.getPluginData(key)
}

console.log('[fig-tail-isolation] private data visible to second plugin ID', data)

const readable = Object.values(data).some((value) => value && value.length > 0)
figma.notify(
  readable
    ? 'ISOLATION FAIL: second plugin ID can read spike data'
    : 'ISOLATION PASS: second plugin ID cannot read spike data',
)

figma.closePlugin()
