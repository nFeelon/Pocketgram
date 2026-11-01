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
  /** insert or replace a row and re-sort — used for peers the first page never returned */
  upsert: (entry: DialogEntry) => void
  bump: (id: string, preview: string, time: number, incUnread: boolean, outId?: number) => void
  markRead: (id: string) => void
  /** authoritative unread from an inbox-read update (read on another device) */
  setUnread: (id: string, unread: number) => void
  setReadOutbox: (id: string, maxReadId: number) => void
  setDraft: (id: string, draft: string | undefined) => void
  /** refresh the row's preview without touching time/order (edits of the latest message) */
  setPreview: (id: string, preview: string) => void
}

const byPinnedThenTime = (a: DialogEntry, b: DialogEntry) =>
  Number(b.pinned) - Number(a.pinned) || b.time - a.time

export const useDialogsStore = create<DialogsState>((set) => {
  // row-patching shared by the id-scoped setters below
  const patch = (id: string, f: (d: DialogEntry) => DialogEntry) =>
    set((s) => ({ dialogs: s.dialogs.map((d) => (d.id === id ? f(d) : d)) }))
  return {
    dialogs: [],
    filter: '',
    setFilter: (filter) => set({ filter }),
    setDialogs: (dialogs) => set({ dialogs: [...dialogs].sort(byPinnedThenTime) }),
    upsert: (entry) =>
      set((s) => ({
        dialogs: [...s.dialogs.filter((d) => d.id !== entry.id), entry].sort(byPinnedThenTime),
      })),
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
    markRead: (id) => patch(id, (d) => ({ ...d, unread: 0 })),
    setUnread: (id, unread) => patch(id, (d) => ({ ...d, unread })),
    setReadOutbox: (id, maxReadId) =>
      patch(id, (d) => (maxReadId > d.readOutbox ? { ...d, readOutbox: maxReadId } : d)),
    setDraft: (id, draft) => patch(id, (d) => ({ ...d, draft })),
    setPreview: (id, preview) => patch(id, (d) => ({ ...d, preview })),
  }
})
