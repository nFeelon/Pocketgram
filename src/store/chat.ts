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
  /** group sender — Bubble shows it when showSender is on */
  senderId?: number
  senderName?: string
  edited?: boolean
  replyTo?: { id: number | null; text: string }
  /** Video.isAnimation — renders as a silent thumb, no viewer */
  isGif?: boolean
}

export interface Compose {
  mode: 'reply' | 'edit'
  /** replied-to / edited message id */
  id: number
  /** plate text: the replied excerpt or the message being edited */
  text: string
}

interface ChatState {
  peerId: string | null
  /** peer the screen just left — open() restores its cached feed instead of refetching */
  prevPeerId: string | null
  title: string
  readOnly: boolean // channels where we can't post
  messages: ChatMessage[]
  /** GetHistoryOffset for the next (older) page; null = history exhausted */
  nextOffset: { id: number; date: number } | null
  loadingMore: boolean
  /** the feed jumped mid-history (search/reply jump) — newest messages aren't loaded */
  detached: boolean
  /** forum topic the feed is scoped to; null = all messages (default) */
  threadId: number | null
  threadTitle: string
  compose: Compose | null
  setCompose: (c: Compose | null) => void
  setThread: (threadId: number | null, threadTitle: string) => void
  open: (peerId: string, title: string, readOnly: boolean) => void
  setMessages: (ms: ChatMessage[], nextOffset: ChatState['nextOffset']) => void
  append: (m: ChatMessage) => void
  prepend: (ms: ChatMessage[]) => void
  replace: (id: number, m: ChatMessage) => void
  remove: (id: number) => void
  setLoadingMore: (v: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  peerId: null,
  prevPeerId: null,
  title: '',
  readOnly: false,
  messages: [],
  nextOffset: null,
  loadingMore: false,
  detached: false,
  threadId: null,
  threadTitle: '',
  compose: null,
  setCompose: (compose) => set({ compose }),
  // switching topics discards the loaded feed — it belongs to the old thread
  setThread: (threadId, threadTitle) =>
    set({ threadId, threadTitle, messages: [], nextOffset: null, loadingMore: false, detached: false, compose: null }),
  open: (peerId, title, readOnly) =>
    // keep messages when re-entering the same chat (e.g. dialogs store refreshed, or
    // the user comes back — unmount keeps the feed under prevPeerId)
    set((s) =>
      s.peerId === peerId || (s.peerId === null && s.prevPeerId === peerId)
        ? { peerId, title, readOnly }
        : {
            peerId,
            prevPeerId: null,
            title,
            readOnly,
            messages: [],
            nextOffset: null,
            loadingMore: false,
            detached: false,
            threadId: null,
            threadTitle: '',
            compose: null,
          },
    ),
  setMessages: (messages, nextOffset) => set({ messages, nextOffset }),
  append: (m) =>
    // dedup: sendText's result and the onNewMessage update can carry the same message
    set((s) => (s.messages.some((x) => x.id === m.id) ? s : { messages: [...s.messages, m] })),
  prepend: (ms) => set((s) => ({ messages: [...ms, ...s.messages] })),
  replace: (id, m) =>
    // the onNewMessage update may have already appended the real message — then just drop the temp one
    // (id === m.id is an in-place edit, never a drop)
    set((s) => ({
      messages: id !== m.id && s.messages.some((x) => x.id === m.id)
        ? s.messages.filter((x) => x.id !== id)
        : s.messages.map((x) => (x.id === id ? m : x)),
    })),
  remove: (id) => set((s) => ({ messages: s.messages.filter((x) => x.id !== id) })),
  setLoadingMore: (loadingMore) => set({ loadingMore }),
}))
