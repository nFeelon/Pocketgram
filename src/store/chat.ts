import { create } from 'zustand'
import type { MediaKind } from '../tg/media.ts'

export interface ChatMessage {
  id: number
  out: boolean
  text: string
  time: number
  mediaKind: MediaKind
  /** media payload understood by tg/media.ts — opaque to the UI */
  media?: unknown
  /** media.mimeType — needed for the playback blob */
  mimeType?: string
  duration?: number
  waveform?: number[]
  size?: number
}

interface ChatState {
  peerId: string | null
  title: string
  readOnly: boolean // channels where we can't post
  messages: ChatMessage[]
  open: (peerId: string, title: string, readOnly: boolean) => void
  append: (m: ChatMessage) => void
  prepend: (ms: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  peerId: null,
  title: '',
  readOnly: false,
  messages: [],
  open: (peerId, title, readOnly) =>
    // keep messages when re-entering the same chat (e.g. dialogs store refreshed)
    set((s) => (s.peerId === peerId ? { title, readOnly } : { peerId, title, readOnly, messages: [] })),
  append: (m) => set((s) => ({ messages: [...s.messages, m] })),
  prepend: (ms) => set((s) => ({ messages: [...ms, ...s.messages] })),
}))
