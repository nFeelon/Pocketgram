import { create } from 'zustand'
import type { AuthField } from '../tg/auth.ts'

export type AuthStage = 'boot' | AuthField | 'qr' | 'ready' | 'error'

interface AuthState {
  stage: AuthStage
  error: string | null
  selfName: string | null
  /** where Telegram delivered the code (from codeSentCallback) — shown under the code field */
  codeVia: string | null
  /** QR login image (data URL) — refreshed as the login token rotates */
  qrImg: string | null
  /** UI submits the current field value → resolves the pending ask() */
  submit: (value: string) => void
  /** internal: wire a pending credential request */
  _ask: (field: AuthField) => Promise<string>
}

let resolver: ((v: string) => void) | null = null

export const useAuthStore = create<AuthState>((set) => ({
  // 'boot' — until tg.start resolves (existing session restores silently, no field flash)
  stage: 'boot',
  error: null,
  selfName: null,
  codeVia: null,
  qrImg: null,
  submit: (value) => {
    resolver?.(value)
    resolver = null
  },
  _ask: (field) =>
    new Promise<string>((resolve) => {
      resolver = resolve
      set({ stage: field, error: null })
    }),
}))

export const authReady = () => useAuthStore.setState({ stage: 'ready' })
export const authError = (message: string) => useAuthStore.setState({ stage: 'error', error: message })
