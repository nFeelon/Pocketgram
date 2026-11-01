import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import OptionsMenu from '../components/OptionsMenu.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import DialogRow from '../components/DialogRow.tsx'
import Confirm from '../components/Confirm.tsx'
import { useDialogsStore } from '../store/dialogs.ts'
import { useConnStore } from '../store/conn.ts'
import { logErr, signOut } from '../tg/auth.ts'
import { loadDialogs } from '../tg/dialogs.ts'
import { initUpdates, forwardMessage } from '../tg/messages.ts'
import { useCleanHash } from '../utils/history.ts'
import SearchIcon from '../assets/icons/search.svg?react'
import './ChatList.css'

/**
 * Focus zones (D-pad, YouTube-style): -1 = search button, 0..n-1 = dialog rows,
 * n..n+SK_COUNT-1 = enabled softkey buttons. Buttons get real DOM focus —
 * Center on them clicks natively; ↓ on a softkey scrolls the list.
 */
// enabled softkeys below: start + end. A zone past the last real button is a
// dead stop whose Enter clicks whatever kept DOM focus.
const SK_COUNT = 2
export default function ChatList() {
  // '#menu' is kept — the menu state mirrors it and re-opens consistently
  useCleanHash('#menu')
  const navigate = useNavigate()
  const dialogs = useDialogsStore((s) => s.dialogs)
  const conn = useConnStore((s) => s.state)
  const filter = useDialogsStore((s) => s.filter)
  const setFilter = useDialogsStore((s) => s.setFilter)
  const [menuVisible, setMenuVisible] = useState(location.hash.includes('#menu'))
  const [exitOpen, setExitOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [flash, setFlash] = useState('')
  const [searchParams] = useSearchParams()
  // '/?forward=<peerId>:<msgId>' — the list becomes a forward-target picker
  const forward = searchParams.get('forward')
  const [focused, setFocused] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // blocks re-entrant sends while a forward is in flight
  const forwardBusy = useRef(false)

  const flashBar = (text: string) => {
    setFlash(text)
    setTimeout(() => setFlash(''), 1500)
  }

  const refresh = () => {
    setStatus('loading')
    void loadDialogs().then(
      () => {
        setStatus('idle')
        flashBar('Обновлено')
      },
      (e) => {
        logErr(e)
        setStatus('error')
        flashBar('Ошибка загрузки')
      },
    )
  }

  // dialogs stay in the store when returning from a chat — updates keep them live
  useEffect(() => {
    initUpdates()
    if (!useDialogsStore.getState().dialogs.length) refresh()
  }, [])

  const visible = dialogs.filter(
    (d) =>
      (!unreadOnly || d.unread > 0) &&
      (!filter || d.title.toLowerCase().includes(filter.toLowerCase())),
  )
  const n = visible.length
  const clamped = Math.min(Math.max(focused, -1), n + SK_COUNT - 1)
  const rowFocused = clamped >= 0 && clamped < n ? clamped : -1

  const softkeyBtns = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('.softkey-bar > button:not([disabled])') ?? [],
    )
  const openDialog = (i: number) => {
    const d = visible[i]
    if (!d) return
    if (forward) {
      // Enter may arrive repeatedly while the RPC runs — one forward per pick
      if (forwardBusy.current) return
      forwardBusy.current = true
      const [from, msg] = forward.split(':')
      void forwardMessage(d.id, from, Number(msg))
        // landing inside the target chat is the visible confirmation
        .then(() => navigate(`/chat/${d.id}`, { replace: true }))
        .catch((e) => {
          logErr(e)
          forwardBusy.current = false
          flashBar('Ошибка пересылки')
        })
      return
    }
    navigate(`chat/${d.id}`)
  }

  // pop the '#menu' entry only if it's actually on top — a blind navigate(-1)
  // can eat a real screen and throw the user out of the widget
  const closeMenu = () => {
    if (location.hash.includes('#menu')) navigate(-1)
    else setMenuVisible(false)
  }

  // sync DOM focus onto the zone's button; keep the focused row on screen
  useEffect(() => {
    if (clamped === -1) searchBtnRef.current?.focus()
    else if (clamped >= n) softkeyBtns()[clamped - n]?.focus()
    else if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()

    if (rowFocused >= 0) {
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
            setFocused(Math.min(n + SK_COUNT - 1, clamped + 1))
          }
          break
        case '*':
          e.preventDefault()
          setUnreadOnly((v) => !v)
          setFocused(0)
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
      {conn !== 'connected' && conn !== 'updating' && (
        <div className="conn-bar">{conn === 'connecting' ? 'Подключение…' : 'Нет сети'}</div>
      )}
      {flash && <div className="conn-bar flash-bar">{flash}</div>}
      <div className="search-row">
        <button
          ref={searchBtnRef}
          className="search-btn"
          aria-label="Поиск"
          // center = "done searching" → drop onto the first row, not back into the IME
          onClick={() => setFocused(0)}
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

      {forward && <div className="forward-hint">Куда переслать?</div>}

      <div className="dialog-list" ref={listRef} role="listbox">
        {visible.map((d, i) => (
          <div
            key={d.id}
            role="option"
            tabIndex={i}
            aria-selected={i === rowFocused}
            className={i === rowFocused ? 'focused' : ''}
            onClick={() => openDialog(i)}
          >
            <DialogRow dialog={d} />
          </div>
        ))}
        {n === 0 && status === 'loading' && (
          <div className="center-loader">
            <span className="spin" />
            <p className="empty">Загрузка…</p>
          </div>
        )}
        {n === 0 && status !== 'loading' && (
          <p className="empty">
            {unreadOnly ? 'Нет непрочитанных' : status === 'error' ? 'Ошибка загрузки' : 'Нет чатов'}
          </p>
        )}
      </div>

      <OptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        // a <Link> child already replaces the '#menu' entry; buttons need an explicit pop
        onMenuItemSelected={(child) => {
          if (child.type !== Link) closeMenu()
        }}
      >
        <button type="button" onClick={refresh}>Обновить</button>
        <Link to="contacts" replace>Контакты</Link>
        <Link to="settings" replace>Настройки</Link>
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
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'start') {
            // closing via history keeps the '#menu' entry in sync with the flag
            if (exitOpen) setExitOpen(false)
            else if (menuVisible) closeMenu()
            else setMenuVisible(true)
          }
          // center row-Enter clicks natively; 'end' fires on button click —
          // hardware RSK is history.back natively. Confirm has no history entry —
          // 'end' must cancel it first, not pop the screen under it
          if (pos === 'end') {
            if (exitOpen) setExitOpen(false)
            else if (menuVisible) closeMenu()
            else navigate(-1)
          }
        }}
      />
    </div>
  )
}
