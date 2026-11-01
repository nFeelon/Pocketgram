import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import OptionsMenu from '../components/OptionsMenu.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import DialogRow from '../components/DialogRow.tsx'
import Confirm from '../components/Confirm.tsx'
import { useDialogsStore } from '../store/dialogs.ts'
import { signOut } from '../tg/auth.ts'
import './ChatList.css'

export default function ChatList() {
  const navigate = useNavigate()
  const dialogs = useDialogsStore((s) => s.dialogs)
  const filter = useDialogsStore((s) => s.filter)
  const setFilter = useDialogsStore((s) => s.setFilter)
  const [menuVisible, setMenuVisible] = useState(location.hash.includes('#menu'))
  const [exitOpen, setExitOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const visible = filter
    ? dialogs.filter((d) => d.title.toLowerCase().includes(filter.toLowerCase()))
    : dialogs
  const clamped = Math.min(focused, Math.max(0, visible.length - 1))

  const openDialog = (i: number) => {
    const d = visible[i]
    if (d) navigate(`chat/${d.id}`)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menuVisible || exitOpen || (e.target as HTMLElement)?.tagName === 'INPUT') return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocused((f) => (f + 1) % Math.max(1, visible.length))
          break
        case 'ArrowUp':
          e.preventDefault()
          // search field sits above the list — up from the first row reaches it
          if (clamped === 0) searchRef.current?.focus()
          else setFocused((f) => f - 1)
          break
        case 'Enter':
          openDialog(clamped)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div id="app">
      <Header title="Pocketgram" status="4G" />

      <input
        ref={searchRef}
        className="search"
        type="text"
        placeholder="Поиск…"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value)
          setFocused(0)
        }}
        onKeyDown={(e) => {
          // back to the list
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
        }}
      />

      <div className="dialog-list" role="listbox">
        {visible.map((d, i) => (
          <div
            key={d.id}
            role="option"
            tabIndex={i}
            aria-selected={i === clamped}
            className={i === clamped ? 'focused' : ''}
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
        // a <Link> child already replaces the '#menu' entry; buttons need an explicit pop
        onMenuItemSelected={(child) => {
          if (child.type !== Link) navigate(-1)
        }}
      >
        <button type="button" onClick={() => {/* TODO: refresh dialogs */}}>Обновить</button>
        <Link to="about" replace>О приложении</Link>
        <button type="button" onClick={() => setExitOpen(true)}>Выйти</button>
      </OptionsMenu>

      {exitOpen && (
        <Confirm
          text="Выйти из аккаунта?"
          onConfirm={() => void signOut()}
          onCancel={() => setExitOpen(false)}
        />
      )}

      <SoftKeyBar
        buttons={{
          start: { icon: 'menu', title: 'Меню' },
          center: { icon: 'select', title: 'Открыть' },
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'start') {
            // closing via history keeps the '#menu' entry in sync with the flag
            if (exitOpen) setExitOpen(false)
            else if (menuVisible) navigate(-1)
            else setMenuVisible(true)
          }
          // 'end' only fires on button click — hardware RSK is history.back natively
          if (pos === 'end') navigate(-1)
          // 'center' (Enter) is handled by the list's own keydown — do not double-navigate
        }}
      />
    </div>
  )
}
