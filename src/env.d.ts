/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.css' {
  const content: string
  export default content
}

interface Window {
  __MECHBOX_BOOT__?: {
    startedAt: number
    minDuration: number
  }
  requestIdleCallback?: (
    callback: (deadline: IdleDeadline) => void,
    options?: { timeout?: number }
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

interface IdleDeadline {
  readonly didTimeout: boolean
  timeRemaining(): number
}
