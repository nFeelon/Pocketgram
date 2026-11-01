import { useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import { useAuthStore } from '../store/auth.ts'
import './About.css'

export default function About() {
  const navigate = useNavigate()
  const selfName = useAuthStore((s) => s.selfName)

  return (
    <div id="app">
      <Header title="О приложении" />
      <section className="about-body">
        <p>Pocketgram — Telegram для кнопочных телефонов на платформе Cloud Phone.</p>
        {selfName && <p>Аккаунт: {selfName}</p>}
        <p>Версия 0.1.0 · MTProto (mtcute)</p>
      </section>
      <SoftKeyBar
        buttons={{ end: { icon: 'back', title: 'Назад' } }}
        onSoftKeyClick={(pos) => pos === 'end' && navigate(-1)}
      />
    </div>
  )
}
