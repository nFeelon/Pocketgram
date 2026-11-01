import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import OptionsMenu from '../components/OptionsMenu.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import DialogRow from '../components/DialogRow.tsx'
import Confirm from '../components/Confirm.tsx'
import { useDialogsStore } from '../store/dialogs.ts'
import { signOut } from '../tg/auth.ts'
import SearchIcon from '../assets/icons/search.svg?react'
import './ChatList.css'

/**
 * Focus zones (D-pad, YouTube-style): -1 = search button, 0..n-1 = dialog rows,
 * n..n+2 = softkey bar buttons (start/center/end). Buttons get real DOM focus —
 * Center on them clicks natively; ↓ on a softkey scrolls the list.
 */
export default function ChatList() {
  const navigate = useNavigate()
  const dialogs = useDialogsStore((s) => s.dialogs)
  const filter = useDialogsStore((s) => s.filter)
  const setFilter = useDialogsStore((s) => s.setFilter)
  const [menuVisible, setMenuVisible] = useState(location.hash.includes('#menu'))
  const [exitOpen, setExitOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const lastRow = useRef(0)

  const visible = filter
    ? dialogs.filter((d) => d.title.toLowerCase().includes(filter.toLowerCase()))
    : dialogs
  const n = visible.length
  const clamped = Math.min(Math.max(focused, -1), n + 2)
  const rowFocused = clamped >= 0 && clamped < n ? clamped : -1

  const softkeyBtns = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('.softkey-bar > button:not([disabled])') ?? [],
    )
  const centerBtn = () => rootRef.current?.querySelector<HTMLButtonElement>('[data-pos="center"]')

  const openDialog = (i: number) => {
    const d = visible[i]
    if (d) navigate(`chat/${d.id}`)
  }

  // sync DOM focus onto the zone's button; keep the focused row on screen
  useEffect(() => {
    if (clamped === -1) searchBtnRef.current?.focus()
    else if (clamped >= n) softkeyBtns()[clamped - n]?.focus()
    else if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()

    if (rowFocused >= 0) {
      lastRow.current = rowFocused
      listRef.current?.querySelector('.focused')?.scrollIntoView({ block: 'nearest' })
    }
  }, [clamped, n, rowFocused])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      // inputs own their keys; Enter on a button clicks natively — don't double-handle
      if (menuVisible || exitOpen || tag === 'INPUT' || (tag === 'BUTTON' && e.key === 'Enter')) return
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          if (clamped > 0 && clamped < n) setFocused(clamped - 1)
          else if (clamped === 0) setFocused(-1) // first row → search button
          else if (clamped >= n) setFocused(n - 1) // softkey bar → last row
          break
        case 'ArrowDown':
          e.preventDefault()
          if (clamped === -1) setFocused(0)
          else if (clamped === n - 1) setFocused(n) // last row → softkey bar
          else if (clamped >= n) listRef.current?.scrollBy({ top: 40 }) // on softkey: scroll content
          else setFocused(clamped + 1)
          break
        case 'ArrowLeft':
          if (clamped >= n) {
            e.preventDefault()
            setFocused(Math.max(n, clamped - 1))
          }
          break
        case 'ArrowRight':
          if (clamped >= n) {
            e.preventDefault()
            setFocused(Math.min(n + 2, clamped + 1))
          }
          break
        case 'Enter':
          if (rowFocused >= 0) openDialog(rowFocused)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div id="app" ref={rootRef}>
      <Header title="Pocketgram" status="4G" />

      <div className="search-row">
        <button
          ref={searchBtnRef}
          className="search-btn"
          aria-label="Поиск"
          onClick={() => searchRef.current?.focus()}
        >
          <SearchIcon />
        </button>
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
            // back to the list / the search button (effect moves DOM focus by zone)
            if (e.key === 'ArrowUp') setFocused(-1)
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape') {
              e.currentTarget.blur()
              setFocused(0)
            }
          }}
        />
      </div>

      <div className="dialog-list" ref={listRef} role="listbox">
        {visible.map((d, i) => (
          <div
            key={d.id}
            role="option"
            tabIndex={i}
            aria-selected={i === rowFocused}
            className={i === rowFocused ? 'focused' : ''}
            onClick={() => navigate(`chat/${d.id}`)}
          >
            <DialogRow dialog={d} />
          </div>
        ))}
        {n === 0 && <p className="empty">Нет чатов</p>}
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
          // row-Enter already opens the dialog — only open when the button itself is focused
          if (pos === 'center' && document.activeElement === centerBtn()) openDialog(lastRow.current)
          // 'end' only fires on button click — hardware RSK is history.back natively
          if (pos === 'end') navigate(-1)
        }}
      />
    </div>
  )
}
