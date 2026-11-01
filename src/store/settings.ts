import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  font: 7 | 8 | 9 | 10 | 11 | 12
  theme: 'dark' | 'light'
  sound: boolean
  vibrate: boolean
  dnd: boolean
  thumbs: boolean
  muted: string[]
  cycleFont: () => void
  toggle: (key: 'theme' | 'sound' | 'vibrate' | 'dnd' | 'thumbs') => void
  toggleMuted: (id: string) => void
}

const FONTS = [7, 8, 9, 10, 11, 12] as const

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      font: 10,
      theme: 'dark',
      sound: true,
      vibrate: true,
      dnd: false,
      thumbs: true,
      muted: [],
      cycleFont: () =>
        set((s) => ({ font: FONTS[(FONTS.indexOf(s.font) + 1) % FONTS.length] })),
      toggle: (key) =>
        set((s) => (key === 'theme' ? { theme: s.theme === 'dark' ? 'light' : 'dark' } : { [key]: !s[key] })),
      toggleMuted: (id) =>
        set((s) => ({
          muted: s.muted.includes(id) ? s.muted.filter((x) => x !== id) : [...s.muted, id],
        })),
    }),
    { name: 'pg-settings' },
  ),
)
