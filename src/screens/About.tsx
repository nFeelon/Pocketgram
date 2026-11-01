import { useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import './About.css'

export default function About() {
  const navigate = useNavigate()
  return (
    <div id="app">
      <Header title="О приложении" />
      <section className="about-body">
        <p>Pocketgram — Telegram для кнопочных телефонов на платформе Cloud Phone.</p>
        <p>Версия 0.1.0 · MTProto (mtcute)</p>
      </section>
      <SoftKeyBar
        buttons={{ end: { icon: 'back', title: 'Назад' } }}
        onSoftKeyClick={() => navigate(-1)}
      />
    </div>
  )
}
