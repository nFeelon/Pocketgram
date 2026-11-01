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
  const listRef = useRef<HTMLDivElement>(null)
  const prevMsgCount = useRef(0)

  const title = dialog?.title
  const dialogType = dialog?.type
  useEffect(() => {
    // TODO: tg.getHistory(peerId) → prepend(); subscribe onNewMessage → append()
    useChatStore.getState().open(peerId, title ?? '', dialogType === 'channel')
  }, [peerId, title, dialogType])

  // enter the chat with the newest message focused (spec: "старт с последнего") —
  // covers async history load too (0 → non-empty transition)
  useEffect(() => {
    if (prevMsgCount.current === 0 && messages.length) setFocused(messages.length - 1)
    prevMsgCount.current = messages.length
  }, [messages.length])

  useEffect(() => {
    void hasFeature('FileDownload').then(setCanDownload)
  }, [])

  // keep the focused bubble on screen while arrowing through the feed
  useEffect(() => {
    listRef.current?.querySelector('.msg-focused')?.scrollIntoView({ block: 'nearest' })
  }, [focused])

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
      if (menuVisible || viewer || (e.target as HTMLElement)?.tagName === 'INPUT') return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (focused >= messages.length - 1) composerRef.current?.focus()
          else setFocused((f) => f + 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocused((f) => Math.max(f - 1, 0))
          break
        case 'Enter': {
          const m = messages[focused]
          if (m?.media && (m.mediaKind === 'photo' || m.mediaKind === 'video' || m.mediaKind === 'video_note')) {
            openViewer({ media: m.media as DownloadableMedia, kind: m.mediaKind, mimeType: m.mimeType, size: m.size })
          } else if (m?.mediaKind === 'voice') {
            // TODO: fetch blob → <audio> play/stop toggle
          }
          break
        }
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
    <div id="app">
      <Header title={dialog?.title ?? 'Чат'} status={dialog?.type === 'channel' ? 'канал' : ''} />

      <div className="message-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={m.id} className={i === focused ? 'msg-focused' : ''}>
            <Bubble msg={m} />
          </div>
        ))}
      </div>

      {!readOnly && <Composer inputRef={composerRef} onSend={send} />}

      <OptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onMenuItemSelected={() => navigate(-1)}
      >
        <button type="button" onClick={() => {/* TODO: info */}}>Информация</button>
        <button type="button" onClick={() => {/* TODO: tg.call messages.readHistory */}}>Прочитано</button>
        {canDownload && (
          <button type="button" onClick={() => {
            const m = messages[focused]
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
          center: { text: readOnly ? '' : 'Отпр.', title: 'Отправить' },
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'start') {
            // Esc closes the topmost overlay first — never open the menu over the viewer
            if (viewer) closeViewer()
            else if (menuVisible) navigate(-1)
            else setMenuVisible(true)
          }
          // 'end' only fires on button click — hardware RSK is history.back natively
          if (pos === 'end') navigate(-1)
          // 'center' (Enter) handled by Composer/the list
        }}
      />
    </div>
  )
}
