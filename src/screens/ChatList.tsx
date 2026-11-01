import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import OptionsMenu from '../components/OptionsMenu.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import DialogRow from '../components/DialogRow.tsx'
import { useDialogsStore } from '../store/dialogs.ts'
import './ChatList.css'

export default function ChatList() {
  const navigate = useNavigate()
  const dialogs = useDialogsStore((s) => s.dialogs)
  const filter = useDialogsStore((s) => s.filter)
  const setFilter = useDialogsStore((s) => s.setFilter)
  const [menuVisible, setMenuVisible] = useState(location.hash.includes('#menu'))
  const [focused, setFocused] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const visible = filter
    ? dialogs.filter((d) => d.title.toLowerCase().includes(filter.toLowerCase()))
    : dialogs

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menuVisible || (e.target as HTMLElement)?.tagName === 'INPUT') return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocused((f) => (f + 1) % Math.max(1, visible.length))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocused((f) => (f - 1 + Math.max(1, visible.length)) % Math.max(1, visible.length))
          break
        case 'Enter': {
          const d = visible[focused]
          if (d) navigate(`chat/${d.id}`)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div id="app">
      <Header title="Pocketgram" status="4G" />

      <input
        className="search"
        type="text"
        placeholder="Поиск…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="dialog-list" ref={listRef} role="listbox">
        {visible.map((d, i) => (
          <div
            key={d.id}
            role="option"
            tabIndex={i}
            aria-selected={i === focused}
            className={i === focused ? 'focused' : ''}
            onClick={() => navigate(`chat/${d.id}`)}
          >
            <DialogRow dialog={d} />
          </div>
        ))}
        {visible.length === 0 && <p className="empty">Нет чатов</p>}
      </div>

      <OptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onMenuItemSelected={() => setMenuVisible(false)}
      >
        <Link to="about" replace>О приложении</Link>
        <button type="button" onClick={() => {/* TODO: refresh dialogs */}}>Обновить</button>
        <button type="button" onClick={() => {/* TODO: logout + confirm */}}>Выйти</button>
      </OptionsMenu>

      <SoftKeyBar
        buttons={{
          start: { icon: 'menu', title: 'Меню' },
          center: { icon: 'select', title: 'Открыть' },
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'start') setMenuVisible((v) => !v)
          if (pos === 'center') {
            const d = visible[focused]
            if (d) navigate(`chat/${d.id}`)
          }
        }}
      />
    </div>
  )
}
