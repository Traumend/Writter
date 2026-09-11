import type { Api } from '../core/types/ipc'

declare global {
  interface Window {
    api: Api
  }
}
