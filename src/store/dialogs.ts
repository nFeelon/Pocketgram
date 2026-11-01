import { create } from 'zustand'
import type { tg } from '../tg/client.ts'

export type DialogType = 'user' | 'group' | 'channel' | 'self'

export interface DialogEntry {
  id: string
  title: string
  type: DialogType
  preview: string
  time: number // unix seconds
  unread: number
  pinned: boolean
  /** last outgoing message id read by the peer — drives the ✓✓ ticks */
  readOutbox: number
  /** id of the last message when it's ours — the row draws ✓/✓✓ next to the preview */
  outId?: number
  /** composer draft kept server-side */
  draft?: string
  /** supergroup with topics enabled — chat menu gets a «Темы» picker */
  isForum?: boolean
  /** peer.photo.small FileLocation — lets Avatar skip a peer-resolve RPC */
  photo?: Parameters<typeof tg.downloadAsBuffer>[0]
}

interface DialogsState {
  dialogs: DialogEntry[]
  filter: string
  setFilter: (q: string) => void
  setDialogs: (d: DialogEntry[]) => void
  bump: (id: string, preview: string, time: number, incUnread: boolean, outId?: number) => void
  markRead: (id: string) => void
  setReadOutbox: (id: string, maxReadId: number) => void
  setDraft: (id: string, draft: string | undefined) => void
  /** refresh the row's preview without touching time/order (edits of the latest message) */
  setPreview: (id: string, preview: string) => void
}

const byPinnedThenTime = (a: DialogEntry, b: DialogEntry) =>
  Number(b.pinned) - Number(a.pinned) || b.time - a.time

export const useDialogsStore = create<DialogsState>((set) => ({
  dialogs: [],
  filter: '',
  setFilter: (filter) => set({ filter }),
  setDialogs: (dialogs) => set({ dialogs: [...dialogs].sort(byPinnedThenTime) }),
  bump: (id, preview, time, incUnread, outId) =>
    set((s) => ({
      dialogs: s.dialogs
        .map((d) =>
          d.id === id
            ? { ...d, preview, time, outId, unread: incUnread ? d.unread + 1 : d.unread }
            : d,
        )
        .sort(byPinnedThenTime),
    })),
  markRead: (id) =>
    set((s) => ({ dialogs: s.dialogs.map((d) => (d.id === id ? { ...d, unread: 0 } : d)) })),
  setReadOutbox: (id, maxReadId) =>
    set((s) => ({
      dialogs: s.dialogs.map((d) =>
        d.id === id && maxReadId > d.readOutbox ? { ...d, readOutbox: maxReadId } : d,
      ),
    })),
  setDraft: (id, draft) =>
    set((s) => ({ dialogs: s.dialogs.map((d) => (d.id === id ? { ...d, draft } : d)) })),
  setPreview: (id, preview) =>
    set((s) => ({ dialogs: s.dialogs.map((d) => (d.id === id ? { ...d, preview } : d)) })),
}))
