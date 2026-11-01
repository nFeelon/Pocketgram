import { Route, Routes } from 'react-router'
import { useAuthStore } from './store/auth.ts'
import Auth from './screens/Auth.tsx'
import ChatList from './screens/ChatList.tsx'
import Chat from './screens/Chat.tsx'
import About from './screens/About.tsx'

export default function App() {
  const stage = useAuthStore((s) => s.stage)

  if (stage !== 'ready') {
    return <Auth />
  }

  return (
    <Routes>
      <Route index element={<ChatList />} />
      <Route path="chat/:peerId" element={<Chat />} />
      <Route path="about" element={<About />} />
    </Routes>
  )
}
