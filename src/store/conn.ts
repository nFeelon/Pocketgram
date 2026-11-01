import { create } from 'zustand'
import type { ConnectionState } from '@mtcute/web'

export const useConnStore = create<{ state: ConnectionState }>(() => ({
  state: 'connecting',
}))
