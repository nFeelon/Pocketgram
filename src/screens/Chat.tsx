import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import OptionsMenu from '../components/OptionsMenu.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import Bubble from '../components/Bubble.tsx'
import Composer from '../components/Composer.tsx'
import MediaViewer from '../components/MediaViewer.tsx'
import { useChatStore } from '../store/chat.ts'
import type { ChatMessage } from '../store/chat.ts'
import { useDialogsStore } from '../store/dialogs.ts'
import { mediaUrl, revokeMediaUrl } from '../tg/media.ts'
import { hasFeature } from '../utils/features.ts'
import './Chat.css'

type DownloadableMedia = Parameters<typeof mediaUrl>[0]

interface ViewerState {
  media: DownloadableMedia
  kind: 'photo' | 'video' | 'video_note'
  mimeType?: string
  size?: number
}

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
  const composerRef = useRef<HTMLInputElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const prevMsgCount = useRef(0)
  const lastRow = useRef(0)

  const n = messages.length
  const clamped = Math.min(Math.max(focused, 0), n + 2)
  const rowFocused = clamped < n ? clamped : -1

  const title = dialog?.title
  const dialogType = dialog?.type
  useEffect(() => {
    // TODO: tg.getHistory(peerId) → prepend(); subscribe onNewMessage → append()
    useChatStore.getState().open(peerId, title ?? '', dialogType === 'channel')
  }, [peerId, title, dialogType])

  // enter the chat with the newest message focused (spec: "старт с последнего") —
  // covers async history load too (0 → non-empty transition)
  useEffect(() => {
    if (prevMsgCount.current === 0 && n) setFocused(n - 1)
    prevMsgCount.current = n
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

  // viewer is a history entry → RSK (popstate) closes it instead of leaving the chat
  useEffect(() => {
    const onPop = () => {
      if (!location.hash.includes('#viewer')) setViewer(null)
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

  const openFocused = () => {
    const m = messages[lastRow.current]
    if (m?.media && (m.mediaKind === 'photo' || m.mediaKind === 'video' || m.mediaKind === 'video_note')) {
      openViewer({ media: m.media as DownloadableMedia, kind: m.mediaKind, mimeType: m.mimeType, size: m.size })
    } else if (m?.mediaKind === 'voice') {
      // TODO: fetch blob → <audio> play/stop toggle
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
      if (menuVisible || viewer || tag === 'INPUT' || (tag === 'BUTTON' && e.key === 'Enter')) return
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
          } else setFocused(clamped - 1)
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
          if (rowFocused >= 0) openFocused()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const send = (text: string) => {
    // TODO: tg.sendText(peerId, text) → append optimistic message
    void text
  }

  return (
    <div id="app" ref={rootRef}>
      <Header title={dialog?.title ?? 'Чат'} status={dialog?.type === 'channel' ? 'канал' : ''} />

      <div className="message-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={m.id} className={i === rowFocused ? 'msg-focused' : ''}>
            <Bubble msg={m} />
          </div>
        ))}
      </div>

      {!readOnly && (
        <Composer
          inputRef={composerRef}
          sendRef={sendRef}
          onSend={send}
          onBelow={() => setFocused(n + 1)}
        />
      )}

      <OptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onMenuItemSelected={() => navigate(-1)}
      >
        <button type="button" onClick={() => {/* TODO: info */}}>Информация</button>
        <button type="button" onClick={() => {/* TODO: tg.call messages.readHistory */}}>Прочитано</button>
        {canDownload && (
          <button type="button" onClick={() => {
            const m = messages[lastRow.current]
            if (m) downloadFocused(m)
          }}>Скачать</button>
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

      <SoftKeyBar
        buttons={{
          start: { icon: 'menu', title: 'Опции' },
          center: { icon: 'select', title: 'Открыть' },
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'start') {
            // Esc closes the topmost overlay first — never open the menu over the viewer
            if (viewer) closeViewer()
            else if (menuVisible) navigate(-1)
            else setMenuVisible(true)
          }
          // row-Enter already opened it — only act when the button itself is focused;
          // the viewer/menu own all input while open
          if (pos === 'center' && !viewer && !menuVisible && document.activeElement === centerBtn()) openFocused()
          // 'end' only fires on button click — hardware RSK is history.back natively
          if (pos === 'end') navigate(-1)
        }}
      />
    </div>
  )
}
