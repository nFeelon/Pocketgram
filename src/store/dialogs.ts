import { create } from 'zustand'

export type DialogType = 'user' | 'group' | 'channel' | 'self'

export interface DialogEntry {
  id: string
  title: string
  type: DialogType
  preview: string
  time: number // unix seconds
  unread: number
  pinned: boolean
}

interface DialogsState {
  dialogs: DialogEntry[]
  filter: string
  setFilter: (q: string) => void
  setDialogs: (d: DialogEntry[]) => void
  bump: (id: string, preview: string, time: number) => void
}

export const useDialogsStore = create<DialogsState>((set) => ({
  // TODO: populate from tg.getDialogs() + onNewMessage
  dialogs: [],
  filter: '',
  setFilter: (filter) => set({ filter }),
  setDialogs: (dialogs) => set({ dialogs }),
  bump: (id, preview, time) =>
    set((s) => ({
      dialogs: s.dialogs
        .map((d) => (d.id === id ? { ...d, preview, time, unread: d.unread + 1 } : d))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.time - a.time),
    })),
}))
