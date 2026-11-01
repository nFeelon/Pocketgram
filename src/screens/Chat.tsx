import { Fragment, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import OptionsMenu from '../components/OptionsMenu.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import Bubble from '../components/Bubble.tsx'
import Composer from '../components/Composer.tsx'
import MediaViewer from '../components/MediaViewer.tsx'
import Confirm from '../components/Confirm.tsx'
import { useChatStore } from '../store/chat.ts'
import type { ChatMessage } from '../store/chat.ts'
import { useDialogsStore } from '../store/dialogs.ts'
import { tg } from '../tg/client.ts'
import type { UserStatusUpdate } from '@mtcute/web'
import { mediaUrl, revokeMediaUrl, mediaKind } from '../tg/media.ts'
import {
  loadInitial,
  loadTail,
  loadOlder,
  sendMessage,
  editMessageText,
  deleteMessage,
  saveDraftFor,
  markRead,
  jumpTo,
  mediaLabel,
} from '../tg/messages.ts'
import { statusText, getUserStatusText, peerInfo } from '../tg/peers.ts'
import type { PeerMeta } from '../tg/peers.ts'
import { useSettingsStore } from '../store/settings.ts'
import { hasFeature } from '../utils/features.ts'
import { formatDay, formatTime } from '../utils/format.ts'
import './Chat.css'

type DownloadableMedia = Parameters<typeof mediaUrl>[0]

interface ViewerState {
  media: DownloadableMedia
  kind: 'photo' | 'video' | 'video_note'
  mimeType?: string
  size?: number
}

/** last focused message id per peer — restored when returning to the chat */
const lastFocusedId = new Map<string, number>()

const urlOf = (m: ChatMessage | undefined) => m?.text.match(/https?:\/\/\S+/)?.[0]

/**
 * Focus zones (D-pad, YouTube-style): 0..n-1 = bubbles, then composer field →
 * ➤ button (DOM focus islands inside Composer), n..n+2 = softkey bar buttons.
 * ↓ on a softkey button scrolls the feed; Center clicks the focused button.
 */
export default function Chat() {
  const { peerId = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useDialogsStore((s) => s.dialogs.find((d) => d.id === peerId))
  const messages = useChatStore((s) => s.messages)
  const readOnly = useChatStore((s) => s.readOnly)
  const [menuVisible, setMenuVisible] = useState(location.hash.includes('#menu'))
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [focused, setFocused] = useState(0)
  const [canDownload, setCanDownload] = useState(false)
  const [peerMeta, setPeerMeta] = useState<PeerMeta | null>(null)
  const [delOpen, setDelOpen] = useState(false)
  const [pinned, setPinned] = useState<{ id: number; text: string } | null>(null)
  const [searchMode, setSearchMode] = useState<'input' | 'results' | null>(null)
  const [searchResults, setSearchResults] = useState<{ id: number; text: string; time: number }[]>([])
  const [searchFocus, setSearchFocus] = useState(0)
  const [userStatus, setUserStatus] = useState('')
  const [feedLoaded, setFeedLoaded] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const composerRef = useRef<HTMLInputElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const playingUrl = useRef<string | null>(null)
  // mirror of playingId readable inside async callbacks
  const playingIdRef = useRef<number | null>(null)
  const prevMsgCount = useRef(0)
  const prevFirstId = useRef<number | undefined>(undefined)
  const lastRow = useRef(0)
  // live mirror of the composer text — passive cleanup can't read detached refs
  const draftRef = useRef('')

  const n = messages.length
  const clamped = Math.min(Math.max(focused, 0), n + 2)
  const rowFocused = clamped < n ? clamped : -1

  // peers opened from Contacts/Info aren't in the dialog list — fetch them once
  useEffect(() => {
    setPeerMeta(null)
    if (dialog) return
    let alive = true
    void peerInfo(peerId)
      .then((m) => {
        if (alive) setPeerMeta(m)
      })
      .catch(console.error)
    return () => {
      alive = false
    }
  }, [peerId, dialog])

  const title = dialog?.title ?? peerMeta?.title
  const dialogType = dialog?.type ?? peerMeta?.type
  useEffect(() => {
    useChatStore.getState().open(peerId, title ?? '', dialogType === 'channel')
  }, [peerId, title, dialogType])

  useEffect(() => {
    const initial =
      useDialogsStore.getState().dialogs.find((d) => d.id === peerId)?.draft ?? ''
    draftRef.current = initial
    setFeedLoaded(false)
    const cs = useChatStore.getState()
    // cached feed restored by open() → pull only the newer tail; detached → rebuild
    void (cs.messages.length && !cs.detached ? loadTail(peerId) : loadInitial(peerId))
      .catch(console.error)
      .finally(() => setFeedLoaded(true))
    return () => {
      // remember where the feed was left + flush the composer draft on the way out
      const m = useChatStore.getState().messages[lastRow.current]
      if (m) lastFocusedId.set(peerId, m.id)
      // edit-mode text belongs to the old message — never to the draft box
      if (draftRef.current !== initial && useChatStore.getState().compose?.mode !== 'edit') {
        void saveDraftFor(peerId, draftRef.current)
      }
      // peerId must not outlive the screen — initUpdates would keep appending here
      useChatStore.setState({ peerId: null, prevPeerId: peerId })
    }
  }, [peerId])

  // user dialogs show live last-seen status in the header
  useEffect(() => {
    setUserStatus('')
    if (dialogType !== 'user') return
    let alive = true
    void getUserStatusText(Number(peerId))
      .then((t) => {
        if (alive) setUserStatus(t)
      })
      .catch(console.error)
    const onStatus = (u: UserStatusUpdate) => {
      if (u.userId === Number(peerId)) setUserStatus(statusText(u.status, u.lastOnline))
    }
    tg.onUserStatusUpdate.add(onStatus)
    return () => {
      alive = false
      tg.onUserStatusUpdate.remove(onStatus)
    }
  }, [peerId, dialogType])

  // enter the chat with the newest message focused (spec: "старт с последнего"),
  // or back on the message focused last time — covers async history load too
  const firstId = messages[0]?.id
  useEffect(() => {
    const prev = prevMsgCount.current
    const delta = n - prev
    if (prev === 0 && n) {
      const remembered = lastFocusedId.get(peerId)
      const idx = remembered === undefined ? -1 : messages.findIndex((m) => m.id === remembered)
      setFocused(idx >= 0 ? idx : n - 1)
    }
    // older page prepended → every index shifts; append/removal at the bottom → only the softkey zone does
    else if (delta && (firstId !== prevFirstId.current || focused >= prev)) setFocused((f) => f + delta)
    prevMsgCount.current = n
    prevFirstId.current = firstId
  }, [n])

  useEffect(() => {
    void hasFeature('FileDownload').then(setCanDownload)
  }, [])

  const softkeyBtns = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('.softkey-bar > button:not([disabled])') ?? [],
    )
  const centerBtn = () => rootRef.current?.querySelector<HTMLButtonElement>('[data-pos="center"]')

  // sync DOM focus onto the softkey zone's button; keep the focused bubble on screen
  useEffect(() => {
    if (clamped >= n) softkeyBtns()[clamped - n]?.focus()
    else if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
    if (rowFocused >= 0) {
      lastRow.current = rowFocused
      listRef.current?.querySelector('.msg-focused')?.scrollIntoView({ block: 'nearest' })
    }
  }, [clamped, n, rowFocused])

  // viewer/search are history entries → RSK (popstate) closes them instead of leaving the chat
  useEffect(() => {
    const onPop = () => {
      if (!location.hash.includes('#viewer')) setViewer(null)
      if (!location.hash.includes('#search')) setSearchMode(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openViewer = (v: ViewerState) => {
    setViewer(v)
    if (!location.hash.includes('#viewer')) navigate('#viewer')
  }

  const closeViewer = () => {
    if (location.hash.includes('#viewer')) navigate(-1)
    else setViewer(null)
  }

  // pop the '#menu' entry only if it's actually on top — a blind navigate(-1)
  // can eat a real screen and throw the user out of the widget
  const closeMenu = () => {
    if (location.hash.includes('#menu')) navigate(-1)
    else setMenuVisible(false)
  }

  // menu items that navigate take over the '#menu' entry — otherwise RSK lands on a dead menu entry
  const navFromMenu = (to: string) => navigate(to, { replace: location.hash.includes('#menu') })

  const openSearch = () => {
    setSearchMode('input')
    if (!location.hash.includes('#search')) navFromMenu('#search')
  }

  const closeSearch = () => {
    if (location.hash.includes('#search')) navigate(-1)
    else setSearchMode(null)
  }

  useEffect(() => {
    if (searchMode === 'input') searchRef.current?.focus()
  }, [searchMode])

  useEffect(() => {
    rootRef.current?.querySelector('.search-overlay .focused')?.scrollIntoView({ block: 'nearest' })
  }, [searchFocus])

  const runSearch = () => {
    const q = searchRef.current?.value.trim()
    if (!q) return
    void tg
      .searchMessages({ chatId: Number(peerId), query: q, limit: 20 })
      .then((res) => {
        setSearchResults(
          res.map((m) => ({
            id: m.id,
            text: m.text || mediaLabel(mediaKind(m.media)),
            time: Math.floor(m.date.getTime() / 1000),
          })),
        )
        setSearchFocus(0)
        setSearchMode('results')
        if (searchRef.current) searchRef.current.value = ''
      })
      .catch(console.error)
  }

  /** focus the message if loaded, otherwise pull the surrounding history page */
  const jumpToMessage = (msgId: number) => {
    const idx = messages.findIndex((m) => m.id === msgId)
    if (idx >= 0) setFocused(idx)
    else
      void jumpTo(peerId, msgId)
        .then((found) => {
          if (found >= 0) {
            // feed swapped wholesale — neutralize the [n] effect's index-shift bookkeeping
            const ms = useChatStore.getState().messages
            prevMsgCount.current = ms.length
            prevFirstId.current = ms[0]?.id
            setFocused(found)
          }
        })
        .catch(console.error)
  }

  const stopAudio = () => {
    audioRef.current?.pause()
    if (playingUrl.current) revokeMediaUrl(playingUrl.current)
    playingUrl.current = null
    playingIdRef.current = null
    setPlayingId(null)
  }

  useEffect(() => () => stopAudio(), [])

  const openFocused = () => {
    const m = messages[lastRow.current]
    if (m?.replyTo?.id != null && !m.media) {
      // text reply → jump to the original (media bubbles keep their center action)
      jumpToMessage(m.replyTo.id)
    } else if (
      m?.media &&
      (m.mediaKind === 'photo' || ((m.mediaKind === 'video' || m.mediaKind === 'video_note') && !m.isGif))
    ) {
      openViewer({ media: m.media as DownloadableMedia, kind: m.mediaKind, mimeType: m.mimeType, size: m.size })
    } else if (m?.media && (m.mediaKind === 'voice' || m.mediaKind === 'audio')) {
      if (playingIdRef.current === m.id) {
        stopAudio()
      } else {
        stopAudio()
        playingIdRef.current = m.id
        setPlayingId(m.id)
        void mediaUrl(m.media as DownloadableMedia, m.mimeType ?? 'audio/ogg')
          .then((url) => {
            // another message may have taken over while the blob downloaded
            if (playingIdRef.current === m.id) {
              playingUrl.current = url
              audioRef.current!.src = url
              void audioRef.current!.play()
            } else revokeMediaUrl(url)
          })
          .catch((e) => {
            console.error(e)
            if (playingIdRef.current === m.id) stopAudio()
          })
      }
    }
  }

  // spec: "Скачать" (FileDownload feature) — fetch blob, hand it to the browser download path
  const downloadFocused = (m: ChatMessage) => {
    if (!m.media) return
    void mediaUrl(m.media as DownloadableMedia, m.mimeType).then((url) => {
      const a = document.createElement('a')
      a.href = url
      a.download = `${m.mediaKind}.${m.mimeType?.split('/')[1] ?? 'bin'}`
      a.click()
      setTimeout(() => revokeMediaUrl(url), 60_000)
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      // inputs own their keys; Enter on a button clicks natively — don't double-handle
      if (menuVisible || viewer || pinned || delOpen || tag === 'INPUT' || (tag === 'BUTTON' && e.key === 'Enter')) return
      if (searchMode === 'results') {
        // the overlay tracks its own index — bubbles keep theirs untouched
        e.preventDefault()
        if (e.key === 'ArrowDown') setSearchFocus((f) => Math.min(searchResults.length - 1, f + 1))
        else if (e.key === 'ArrowUp') setSearchFocus((f) => Math.max(0, f - 1))
        else if (e.key === 'Enter') {
          const r = searchResults[searchFocus]
          if (r) {
            closeSearch()
            jumpToMessage(r.id)
          }
        } else if (e.key === 'Escape') closeSearch()
        return
      }
      if (searchMode) {
        if (e.key === 'Escape') closeSearch()
        return
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (clamped === n - 1) {
            // last bubble → composer field; read-only chats drop straight to the bar
            if (readOnly) setFocused(n + 1)
            else composerRef.current?.focus()
          } else if (clamped >= n) {
            // on the softkey bar: ↓ scrolls the feed, focus stays
            listRef.current?.scrollBy({ top: 40 })
          } else setFocused(clamped + 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (clamped >= n) {
            // n === 0: no row to return to — leave the zone on the bar; the input keeps DOM focus
            if (!readOnly) composerRef.current?.focus()
            if (n > 0) setFocused(n - 1)
          } else if (clamped === 0) {
            // top bubble → page older history; the [n] effect keeps focus on the same message
            void loadOlder(peerId).catch(console.error)
          } else setFocused(clamped - 1)
          break
        case 'ArrowLeft':
          if (rowFocused >= 0) {
            e.preventDefault()
            // ←/→ on a bubble = previous/next chat in dialog order
            const ds = useDialogsStore.getState().dialogs
            const i = ds.findIndex((d) => d.id === peerId)
            if (i > 0) navigate(`/chat/${ds[i - 1].id}`, { replace: true })
          } else if (clamped >= n) {
            e.preventDefault()
            setFocused(Math.max(n, clamped - 1))
          }
          break
        case 'ArrowRight':
          if (rowFocused >= 0) {
            e.preventDefault()
            const ds = useDialogsStore.getState().dialogs
            const i = ds.findIndex((d) => d.id === peerId)
            if (i >= 0 && i + 1 < ds.length) navigate(`/chat/${ds[i + 1].id}`, { replace: true })
          } else if (clamped >= n) {
            e.preventDefault()
            setFocused(Math.min(n + 2, clamped + 1))
          }
          break
        case '#':
          e.preventDefault()
          // after a mid-history jump the tail is missing — reload instead of focusing a phantom last
          if (useChatStore.getState().detached) {
            void loadInitial(peerId)
              .then(() => setFocused(useChatStore.getState().messages.length - 1))
              .catch(console.error)
          } else setFocused(n - 1)
          break
        case 'Enter':
          if (rowFocused >= 0) openFocused()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const send = (text: string) => {
    const compose = useChatStore.getState().compose
    useChatStore.getState().setCompose(null)
    if (compose?.mode === 'edit') {
      void editMessageText(peerId, compose.id, text).catch(console.error)
      return
    }
    const opts = compose ? { replyTo: { id: compose.id, text: compose.text } } : undefined
    // mid-history feed: an appended bubble would sit after old messages — reload first
    if (useChatStore.getState().detached) {
      void loadInitial(peerId)
        .then(() => sendMessage(peerId, text, opts))
        .catch(console.error)
    } else void sendMessage(peerId, text, opts).catch(console.error)
  }

  const fm = messages[lastRow.current]
  const replyFocused = () => {
    if (!fm) return
    useChatStore.getState().setCompose({ mode: 'reply', id: fm.id, text: fm.text || mediaLabel(fm.mediaKind) })
    composerRef.current?.focus()
  }
  const quoteFocused = () => {
    if (composerRef.current && fm) {
      composerRef.current.value = `«${fm.text}» ${composerRef.current.value}`
      draftRef.current = composerRef.current.value
      composerRef.current.focus()
    }
  }
  const editFocused = () => {
    if (!fm || !composerRef.current) return
    useChatStore.getState().setCompose({ mode: 'edit', id: fm.id, text: fm.text })
    composerRef.current.value = fm.text
    composerRef.current.focus()
  }
  const forwardFocused = () => {
    if (fm) navFromMenu(`/?forward=${encodeURIComponent(`${peerId}:${fm.id}`)}`)
  }
  const openLink = () => {
    const url = urlOf(fm)
    // shortcut: single-tab widget reloads on return, open in-app reader if it matters
    if (url) location.href = url
  }
  const deleteFocused = () => {
    setDelOpen(false)
    if (fm) void deleteMessage(peerId, fm.id).catch(console.error)
  }
  const showPinned = () => {
    const id = Number(peerId)
    const req = id > 0 ? tg.getFullUser(id) : tg.getFullChat(id)
    void req
      .then((full) =>
        full.pinnedMsgId
          ? tg.getMessages(id, full.pinnedMsgId).then(([m]) =>
              setPinned({
                id: full.pinnedMsgId!,
                text: m ? m.text || mediaLabel(mediaKind(m.media)) : '—',
              }),
            )
          : setPinned({ id: 0, text: 'Нет закреплённых' }),
      )
      .catch(console.error)
  }
  const muted = useSettingsStore((s) => s.muted.includes(peerId))
  const toggleMuted = useSettingsStore((s) => s.toggleMuted)

  const statusFor = (m: ChatMessage) => {
    if (!m.out) return undefined
    if (m.id < 0) return 'sending' as const
    return m.id <= (dialog?.readOutbox ?? peerMeta?.readOutbox ?? 0)
      ? ('read' as const)
      : ('sent' as const)
  }

  return (
    <div id="app" ref={rootRef}>
      <Header title={title ?? 'Чат'} status={dialogType === 'channel' ? 'канал' : userStatus} />

      <div className="message-list" ref={listRef}>
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const newDay =
            !prev ||
            new Date(m.time * 1000).toDateString() !== new Date(prev.time * 1000).toDateString()
          return (
            <Fragment key={m.id}>
              {newDay && <div className="date-sep">{formatDay(m.time)}</div>}
              <div className={i === rowFocused ? 'msg-focused' : ''}>
                <Bubble
                  msg={m}
                  playing={m.id === playingId}
                  showSender={dialogType === 'group' && !m.out}
                  status={statusFor(m)}
                />
              </div>
            </Fragment>
          )
        })}
        {n === 0 && <p className="empty">{feedLoaded ? 'Нет сообщений' : 'Загрузка…'}</p>}
      </div>

      {searchMode === 'input' && (
        <div className="chat-search">
          <input
            ref={searchRef}
            className="search"
            type="text"
            placeholder="Поиск…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch()
              if (e.key === 'ArrowDown') searchBtnRef.current?.focus()
              if (e.key === 'Escape' || e.key === 'ArrowUp') e.currentTarget.blur()
            }}
          />
          <button
            ref={searchBtnRef}
            className="search-btn"
            type="button"
            onClick={runSearch}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') searchRef.current?.focus()
            }}
          >
            Найти
          </button>
        </div>
      )}

      {!readOnly && (
        <Composer
          key={peerId}
          inputRef={composerRef}
          sendRef={sendRef}
          onSend={send}
          onBelow={() => setFocused(n + 1)}
          initialValue={dialog?.draft ?? peerMeta?.draft}
          onDraftChange={(v) => (draftRef.current = v)}
        />
      )}

      <OptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onMenuItemSelected={closeMenu}
      >
        {!readOnly && fm && <button type="button" onClick={replyFocused}>Ответить</button>}
        {!readOnly && fm && <button type="button" onClick={quoteFocused}>Цитировать</button>}
        {fm && <button type="button" onClick={forwardFocused}>Переслать</button>}
        {urlOf(fm) && <button type="button" onClick={openLink}>Открыть ссылку</button>}
        {!readOnly && fm?.out && !!fm.text && fm.id > 0 && (
          <button type="button" onClick={editFocused}>Изменить</button>
        )}
        {fm?.out && fm.id > 0 && (
          <button type="button" onClick={() => setDelOpen(true)}>Удалить</button>
        )}
        <button type="button" onClick={openSearch}>Поиск</button>
        <button type="button" onClick={showPinned}>Закреплённое</button>
        <button type="button" onClick={() => navFromMenu(`/info/${peerId}`)}>Информация</button>
        <button type="button" onClick={() => toggleMuted(peerId)}>
          {muted ? 'Со звуком' : 'Без звука'}
        </button>
        <button type="button" onClick={() => void markRead(peerId)}>Прочитано</button>
        {canDownload && !!fm?.media && (
          <button type="button" onClick={() => downloadFocused(fm)}>Скачать</button>
        )}
      </OptionsMenu>

      {viewer && (
        <MediaViewer
          media={viewer.media}
          kind={viewer.kind}
          mimeType={viewer.mimeType}
          size={viewer.size}
          onClose={closeViewer}
        />
      )}

      {pinned && (
        <Confirm
          text={pinned.id ? `📌 ${pinned.text}` : pinned.text}
          onConfirm={() => {
            setPinned(null)
            if (pinned.id) jumpToMessage(pinned.id)
          }}
          onCancel={() => setPinned(null)}
        />
      )}

      {delOpen && (
        <Confirm
          text="Удалить сообщение?"
          onConfirm={deleteFocused}
          onCancel={() => setDelOpen(false)}
        />
      )}

      {searchMode === 'results' && (
        <div className="options-menu search-overlay">
          {searchResults.length === 0 && <p className="empty">Ничего не найдено</p>}
          {searchResults.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={i === searchFocus ? 'focused' : ''}
              onClick={() => {
                closeSearch()
                jumpToMessage(r.id)
              }}
            >
              {formatTime(r.time)} · {r.text || '—'}
            </button>
          ))}
        </div>
      )}

      <audio ref={audioRef} onEnded={stopAudio} hidden />

      <SoftKeyBar
        buttons={{
          start: { icon: 'menu', title: 'Опции' },
          center: { icon: 'select', title: 'Открыть' },
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'start') {
            // Esc closes the topmost overlay first — never open the menu over the viewer
            if (searchMode) closeSearch()
            else if (delOpen) setDelOpen(false)
            else if (pinned) setPinned(null)
            else if (viewer) closeViewer()
            else if (menuVisible) closeMenu()
            else setMenuVisible(true)
          }
          // row-Enter already opened it — only act when the button itself is focused;
          // the viewer/menu own all input while open
          if (pos === 'center' && !viewer && !menuVisible && !delOpen && !pinned && !searchMode && document.activeElement === centerBtn()) openFocused()
          // 'end' only fires on button click — hardware RSK is history.back natively
          if (pos === 'end') navigate(-1)
        }}
      />
    </div>
  )
}
