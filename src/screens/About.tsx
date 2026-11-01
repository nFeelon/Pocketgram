import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import { useAuthStore } from '../store/auth.ts'
import { useCleanHash } from '../utils/history.ts'
import './About.css'

export default function About() {
  const navigate = useNavigate()
  useCleanHash()
  const selfName = useAuthStore((s) => s.selfName)
  const bodyRef = useRef<HTMLElement>(null)

  // no list-focus on this screen — arrows scroll the body directly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); bodyRef.current?.scrollBy({ top: 24 }) }
      if (e.key === 'ArrowUp') { e.preventDefault(); bodyRef.current?.scrollBy({ top: -24 }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div id="app">
      <Header title="О приложении" />
      <section className="about-body" ref={bodyRef}>
        <p>Pocketgram — Telegram для кнопочных телефонов на платформе Cloud Phone.</p>
        {selfName && <p>Аккаунт: {selfName}</p>}
        <p>Версия 0.1.0 · MTProto (mtcute)</p>
      </section>
      <SoftKeyBar
        buttons={{ end: { icon: 'back', title: 'Назад' } }}
        // 'start' = Escape too: on devices where RSK isn't a real popstate, LSK still exits
        onSoftKeyClick={(pos) => pos !== 'center' && navigate(-1)}
      />
    </div>
  )
}
