import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import { useSettingsStore } from '../store/settings.ts'
import { useConnStore } from '../store/conn.ts'
import './About.css'

const CONN_LABEL = { offline: 'нет сети', connecting: 'подключение', updating: 'в сети', connected: 'в сети' }
const THEME_LABEL = { dark: 'тёмная', light: 'светлая' }
const onOff = (v: boolean) => (v ? 'вкл' : 'выкл')

export default function Settings() {
  const navigate = useNavigate()
  const s = useSettingsStore()
  const conn = useConnStore((x) => x.state)
  const rootRef = useRef<HTMLDivElement>(null)

  // body rows + the softkey bar — "Назад" must be reachable by D-pad too
  const btns = () => Array.from(rootRef.current?.querySelectorAll('button') ?? [])
  useEffect(() => {
    btns()[0]?.focus()
  }, [])

  // ↑↓ move DOM focus between the row buttons; Enter clicks natively
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const list = btns()
      const i = list.indexOf(document.activeElement as HTMLButtonElement)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        ;(list[i + 1] ?? list[0])?.focus()
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        ;(list[i - 1] ?? list[list.length - 1])?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div id="app" ref={rootRef}>
      <Header title="Настройки" />
      <section className="about-body settings-body">
        <button onClick={() => s.cycleFont()}>Шрифт: {s.font}pt</button>
        <button onClick={() => s.toggle('theme')}>Тема: {THEME_LABEL[s.theme]}</button>
        <button onClick={() => s.toggle('sound')}>Звук: {onOff(s.sound)}</button>
        <button onClick={() => s.toggle('vibrate')}>Вибрация: {onOff(s.vibrate)}</button>
        <button onClick={() => s.toggle('dnd')}>Не беспокоить: {onOff(s.dnd)}</button>
        <button onClick={() => s.toggle('thumbs')}>Миниатюры: {onOff(s.thumbs)}</button>
        <p>Соединение: {CONN_LABEL[conn]}</p>
      </section>
      <SoftKeyBar
        buttons={{ end: { icon: 'back', title: 'Назад' } }}
        // 'start' = Escape too: on devices where RSK isn't a real popstate, LSK still exits
        onSoftKeyClick={(pos) => pos !== 'center' && navigate(-1)}
      />
    </div>
  )
}
