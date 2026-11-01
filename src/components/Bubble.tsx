import { memo, useEffect, useState } from 'react'
import type { ChatMessage } from '../store/chat.ts'
import { useSettingsStore } from '../store/settings.ts'
import { mediaUrl, revokeMediaUrl, thumbOf } from '../tg/media.ts'
import { colorFor } from './Avatar.tsx'
import { formatTime, formatDuration, formatSize } from '../utils/format.ts'
import PlayIcon from '../assets/icons/play.svg?react'
import './Bubble.css'

/** Downloads a small blob (sticker, thumb) and shows it as <img>; falls back while loading */
function BlobImg({
  src,
  mime,
  className,
  alt,
  fallback,
}: {
  src: Parameters<typeof mediaUrl>[0]
  mime: string
  className: string
  alt: string
  fallback?: React.ReactNode
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let created: string | undefined
    void mediaUrl(src, mime).then((u) => {
      if (alive) setUrl((created = u))
      else revokeMediaUrl(u)
    })
    return () => {
      alive = false
      if (created) revokeMediaUrl(created)
    }
  }, [src, mime])
  return url ? <img className={className} src={url} alt={alt} draggable={false} /> : (fallback ?? null)
}

function Waveform({ bars }: { bars: number[] }) {
  const w = bars.length * 3
  const max = Math.max(1, ...bars)
  const h = (v: number) => Math.max(2, Math.round((v / max) * 14))
  return (
    <svg className="wave" width={w} height={14} viewBox={`0 0 ${w} 14`} aria-hidden>
      {bars.map((v, i) => (
        <rect key={i} x={i * 3} y={14 - h(v)} width={2} rx={1} height={h(v)} fill="currentColor" />
      ))}
    </svg>
  )
}

/**
 * Message bubble. Media bodies are lazy: thumbs render cheap placeholders,
 * full blobs are fetched only when the user opens them (MediaViewer / play key).
 */
// memo: D-pad focus moves re-render the whole list on every keypress —
// bubbles whose props didn't change skip the work entirely
const Bubble = memo(function Bubble({
  msg,
  showSender,
  status,
}: {
  msg: ChatMessage
  /** group chats: name the sender of incoming messages */
  showSender?: boolean
  /** outgoing read state: ⏱ sending / ✓ sent / ✓✓ read */
  status?: 'sending' | 'sent' | 'read'
}) {
  const thumbs = useSettingsStore((s) => s.thumbs)
  const renderMedia = () => {
    // thumbnails setting off → placeholders only (saves MTProto download traffic)
    const thumb = thumbs ? thumbOf(msg.media) : null
    switch (msg.mediaKind) {
      case 'photo':
        return thumb ? (
          <BlobImg
            src={thumb}
            mime="image/jpeg"
            className="media photo-thumb"
            alt="Фото"
            fallback={<div className="media photo-thumb">[Фото]</div>}
          />
        ) : (
          <div className="media photo-thumb">[Фото]</div>
        )
      case 'video':
      case 'video_note':
        // GIFs are silent loops — no play affordance, no fullscreen viewer
        return (
          <div className="media video-thumb" role="button" aria-label="Видео">
            {thumb && <BlobImg src={thumb} mime="image/jpeg" className="thumb" alt="" />}
            {msg.isGif && !thumb && <span>GIF</span>}
            {!msg.isGif && (
              <>
                <PlayIcon />
                <span className="media-meta">
                  {msg.duration ? formatDuration(msg.duration) : ''}
                  {msg.size ? ` · ${formatSize(msg.size)}` : ''}
                </span>
              </>
            )}
          </div>
        )
      case 'voice':
        return (
          <div className="media voice" role="button" aria-label="Голосовое">
            <PlayIcon />
            {msg.waveform && <Waveform bars={msg.waveform} />}
            <span className="media-meta">{msg.duration ? formatDuration(msg.duration) : ''}</span>
          </div>
        )
      case 'audio':
        return (
          <div className="media voice" role="button" aria-label="Аудио">
            <PlayIcon />
            <span>Аудио</span>
            <span className="media-meta">{msg.duration ? formatDuration(msg.duration) : ''}</span>
          </div>
        )
      case 'sticker':
        return msg.media && thumbs
          ? (
            <BlobImg
              src={msg.media as Parameters<typeof mediaUrl>[0]}
              mime="image/webp"
              className="media sticker"
              alt="Стикер"
              fallback={<div className="media">[Стикер]</div>}
            />
          )
          : <div className="media">[Стикер]</div>
      case 'file':
        return <div className="media">[Файл{msg.size ? ` ${formatSize(msg.size)}` : ''}]</div>
      default:
        return null
    }
  }

  return (
    <div className={`bubble ${msg.out ? 'out' : 'in'}`} tabIndex={0}>
      {showSender && msg.senderName && (
        <span className="sender" style={{ color: colorFor(String(msg.senderId ?? msg.senderName)) }}>
          {msg.senderName}
        </span>
      )}
      {msg.replyTo && <div className="reply-plate">↩ {msg.replyTo.text || 'сообщение'}</div>}
      {renderMedia()}
      {msg.text && <span className="bubble-text">{msg.text}</span>}
      <span className="bubble-time">
        {msg.edited && 'изм. '}
        {formatTime(msg.time)}
        {msg.out && status && (
          <span className="msg-status">
            {status === 'sending' ? ' ⏱' : status === 'read' ? ' ✓✓' : ' ✓'}
          </span>
        )}
      </span>
    </div>
  )
})

export default Bubble
