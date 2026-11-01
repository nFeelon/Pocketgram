import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import DialogRow from '../components/DialogRow.tsx'
import { tg } from '../tg/client.ts'
import SearchIcon from '../assets/icons/search.svg?react'
import '../components/DialogRow.css'
import './ChatList.css'

interface ContactEntry {
  id: string
  name: string
  phone: string
  photo?: Parameters<typeof tg.downloadAsBuffer>[0]
}

/** Same focus zones as ChatList: -1 = search button, rows, n..n+2 = softkey bar */
export default function Contacts() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<ContactEntry[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [filter, setFilter] = useState('')
  const [focused, setFocused] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const lastRow = useRef(0)

  useEffect(() => {
    void tg.getContacts().then(
      (users) => {
        setContacts(
          users
            .map((u) => ({
              id: String(u.id),
              name: u.displayName,
              phone: u.phoneNumber ?? '',
              photo: u.photo?.small,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
        setStatus('idle')
      },
      (e) => {
        console.error(e)
        setStatus('error')
      },
    )
  }, [])

  const visible = filter
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(filter.toLowerCase()) ||
          c.phone.replace(/\D/g, '').includes(filter.replace(/\D/g, '')),
      )
    : contacts
  const n = visible.length
  const clamped = Math.min(Math.max(focused, -1), n + 2)
  const rowFocused = clamped >= 0 && clamped < n ? clamped : -1

  const softkeyBtns = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('.softkey-bar > button:not([disabled])') ?? [],
    )
  const centerBtn = () => rootRef.current?.querySelector<HTMLButtonElement>('[data-pos="center"]')

  const openContact = (i: number) => {
    const c = visible[i]
    if (c) navigate(`/chat/${c.id}`)
  }

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
      if (tag === 'INPUT' || (tag === 'BUTTON' && e.key === 'Enter')) return
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          if (clamped > 0 && clamped < n) setFocused(clamped - 1)
          else if (clamped === 0) setFocused(-1)
          else if (clamped >= n) setFocused(n - 1)
          break
        case 'ArrowDown':
          e.preventDefault()
          if (clamped === -1) setFocused(0)
          else if (clamped === n - 1) setFocused(n)
          else if (clamped >= n) listRef.current?.scrollBy({ top: 40 })
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
          if (rowFocused >= 0) openContact(rowFocused)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div id="app" ref={rootRef}>
      <div className="search-row">
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
            if (e.key === 'ArrowUp') setFocused(-1)
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape') {
              e.currentTarget.blur()
              setFocused(0)
            }
          }}
        />
        <button
          ref={searchBtnRef}
          className="search-btn"
          aria-label="Поиск"
          // center = "done searching" → drop onto the first row, not back into the IME
          onClick={() => setFocused(0)}
        >
          <SearchIcon />
        </button>
      </div>

      <div className="dialog-list" ref={listRef} role="listbox">
        {visible.map((c, i) => (
          <div
            key={c.id}
            role="option"
            tabIndex={i}
            aria-selected={i === rowFocused}
            className={i === rowFocused ? 'focused' : ''}
            onClick={() => openContact(i)}
          >
            <DialogRow
              dialog={{
                id: c.id,
                title: c.name,
                type: 'user',
                preview: c.phone ? (c.phone.startsWith('+') ? c.phone : `+${c.phone}`) : '',
                time: 0,
                unread: 0,
                pinned: false,
                readOutbox: 0,
                photo: c.photo,
              }}
            />
          </div>
        ))}
        {n === 0 && (
          <p className="empty">
            {status === 'loading'
              ? 'Загрузка…'
              : status === 'error'
                ? 'Ошибка загрузки'
                : 'Нет контактов'}
          </p>
        )}
      </div>

      <SoftKeyBar
        buttons={{
          center: { icon: 'select', title: 'Открыть' },
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'center' && document.activeElement === centerBtn()) openContact(lastRow.current)
          // 'start' = Escape too: on devices where RSK isn't a real popstate, LSK still exits
          if (pos === 'end' || pos === 'start') navigate(-1)
        }}
      />
    </div>
  )
}
