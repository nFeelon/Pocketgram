import { create } from 'zustand'
import type { AuthField } from '../tg/auth.ts'

export type AuthStage = 'boot' | AuthField | 'ready' | 'error'

interface AuthState {
  stage: AuthStage
  error: string | null
  selfName: string | null
  /** UI submits the current field value → resolves the pending ask() */
  submit: (value: string) => void
  /** internal: wire a pending credential request */
  _ask: (field: AuthField) => Promise<string>
}

let resolver: ((v: string) => void) | null = null

export const useAuthStore = create<AuthState>((set) => ({
  stage: 'phone',
  error: null,
  selfName: null,
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
