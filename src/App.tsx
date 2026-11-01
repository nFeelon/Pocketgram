import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuthStore } from './store/auth.ts'
import { useSettingsStore } from './store/settings.ts'
import Auth from './screens/Auth.tsx'
import ChatList from './screens/ChatList.tsx'
import Chat from './screens/Chat.tsx'
import About from './screens/About.tsx'
import Contacts from './screens/Contacts.tsx'
import Info from './screens/Info.tsx'
import Settings from './screens/Settings.tsx'

export default function App() {
  const stage = useAuthStore((s) => s.stage)
  const theme = useSettingsStore((s) => s.theme)
  const font = useSettingsStore((s) => s.font)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.setProperty('--fs', String(font / 10))
  }, [theme, font])

  if (stage !== 'ready') {
    return <Auth />
  }

  return (
    <Routes>
      <Route index element={<ChatList />} />
      <Route path="chat/:peerId" element={<Chat />} />
      <Route path="contacts" element={<Contacts />} />
      <Route path="info/:peerId" element={<Info />} />
      <Route path="settings" element={<Settings />} />
      <Route path="about" element={<About />} />
      {/* a stale/bad hash path would render a blank screen — fall back to the list */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
