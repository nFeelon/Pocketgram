import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import Header from '../components/Header.tsx'
import OptionsMenu from '../components/OptionsMenu.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import Bubble from '../components/Bubble.tsx'
import Composer from '../components/Composer.tsx'
import MediaViewer from '../components/MediaViewer.tsx'
import { useChatStore } from '../store/chat.ts'
import { useDialogsStore } from '../store/dialogs.ts'
import type { mediaUrl } from '../tg/media.ts'
import './Chat.css'

type DownloadableMedia = Parameters<typeof mediaUrl>[0]

export default function Chat() {
  const { peerId = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useDialogsStore((s) => s.dialogs.find((d) => d.id === peerId))
  const messages = useChatStore((s) => s.messages)
  const readOnly = useChatStore((s) => s.readOnly)
  const [menuVisible, setMenuVisible] = useState(location.hash.includes('#menu'))
  const [viewer, setViewer] = useState<{ media: DownloadableMedia; kind: 'photo' | 'video' | 'video_note'; size?: number } | null>(null)
  const [focused, setFocused] = useState(0)

  useEffect(() => {
    // TODO: tg.getHistory(peerId) → prepend(); subscribe onNewMessage → append()
    useChatStore.getState().open(peerId, dialog?.title ?? '', dialog?.type === 'channel')
  }, [peerId, dialog])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menuVisible || viewer || (e.target as HTMLElement)?.tagName === 'INPUT') return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocused((f) => Math.min(f + 1, messages.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocused((f) => Math.max(f - 1, 0))
          break
        case 'Enter': {
          const m = messages[focused]
          if (m?.media && (m.mediaKind === 'photo' || m.mediaKind === 'video' || m.mediaKind === 'video_note')) {
            setViewer({ media: m.media as DownloadableMedia, kind: m.mediaKind, size: m.size })
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

      <div className="message-list">
        {messages.map((m, i) => (
          <div key={m.id} className={i === focused ? 'msg-focused' : ''}>
            <Bubble msg={m} />
          </div>
        ))}
      </div>

      {!readOnly && <Composer onSend={send} />}

      <OptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onMenuItemSelected={() => setMenuVisible(false)}
      >
        <button type="button" onClick={() => {/* TODO: info */}}>Информация</button>
        <button type="button" onClick={() => {/* TODO: mark read */}}>Прочитано</button>
        <Link to="about" replace>О приложении</Link>
      </OptionsMenu>

      {viewer && (
        <MediaViewer
          media={viewer.media}
          kind={viewer.kind}
          size={viewer.size}
          onClose={() => setViewer(null)}
        />
      )}

      <SoftKeyBar
        buttons={{
          start: { icon: 'menu', title: 'Опции' },
          center: { text: readOnly ? '' : 'Отпр.', title: 'Отправить' },
          end: { icon: 'back', title: 'Назад' },
        }}
        onSoftKeyClick={(pos) => {
          if (pos === 'start') setMenuVisible((v) => !v)
          if (pos === 'end') navigate(-1)
        }}
      />
    </div>
  )
}
