/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register'
import { toastManager } from './components/ui/toast'

const updateSW = registerSW({
  onNeedRefresh() {
    toastManager.add({
      title: 'A fresh version of Recallbox is ready',
      description:
        'Save any open draft before reloading. Your saved library will stay.',
      timeout: 0,
      actionProps: {
        children: 'Reload to update',
        onClick: () => {
          void updateSW(true)
        },
      },
    })
  },
  onOfflineReady() {
    toastManager.add({
      title: 'Ready to learn offline',
      description: 'Recallbox is now available without a connection.',
    })
  },
})
