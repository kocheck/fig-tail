import { runDevMode } from './mode-dev'
import { handleUiMessage, runDesignMode } from './mode-design'
import type { PluginMessage } from './shared/messages'

if (figma.editorType === 'dev') {
  runDevMode()
} else {
  runDesignMode()
}

figma.ui.onmessage = (msg: PluginMessage | { type: string }) => {
  void handleUiMessage(msg as PluginMessage)
}
