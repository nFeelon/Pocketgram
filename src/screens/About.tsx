import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import { useAuthStore } from '../store/auth.ts'
import './About.css'

export default function About() {
  const navigate = useNavigate()
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
        <p className="keys">↑↓ — листать</p>
        {selfName && <p>Аккаунт: {selfName}</p>}
        <p className="keys">
          Центр — выбрать · ↑↓←→ — навигация<br />
          ↓ у нижних кнопок — листать ленту<br />
          Левая — меню · Правая — назад
        </p>
        <p>Версия 0.1.0 · MTProto (mtcute)</p>
      </section>
      <SoftKeyBar
        buttons={{ end: { icon: 'back', title: 'Назад' } }}
        onSoftKeyClick={(pos) => pos === 'end' && navigate(-1)}
      />
    </div>
  )
}
