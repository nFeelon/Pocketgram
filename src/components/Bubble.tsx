import { useEffect, useState } from 'react'
import type { ChatMessage } from '../store/chat.ts'
import { mediaUrl, revokeMediaUrl } from '../tg/media.ts'
import { formatTime, formatDuration, formatSize } from '../utils/format.ts'
import PlayIcon from '../assets/icons/play.svg?react'
import './Bubble.css'

/** webp stickers render inline; tgs/video stickers fall back to the placeholder */
function StickerThumb({ media }: { media: Parameters<typeof mediaUrl>[0] }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let created: string | undefined
    void mediaUrl(media, 'image/webp').then((u) => {
      if (alive) setUrl((created = u))
      else revokeMediaUrl(u)
    })
    return () => {
      alive = false
      if (created) revokeMediaUrl(created)
    }
  }, [media])
  return url
    ? <img className="media sticker" src={url} alt="Стикер" draggable={false} />
    : <div className="media">[Стикер]</div>
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
export default function Bubble({ msg }: { msg: ChatMessage }) {
  const renderMedia = () => {
    switch (msg.mediaKind) {
      case 'photo':
        // TODO: thumbnail blob via tg/media.ts
        return <div className="media photo-thumb">[Фото]</div>
      case 'video':
      case 'video_note':
        return (
          <div className="media video-thumb" role="button" aria-label="Видео">
            <PlayIcon />
            <span className="media-meta">
              {msg.duration ? formatDuration(msg.duration) : ''}
              {msg.size ? ` · ${formatSize(msg.size)}` : ''}
            </span>
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
        return <div className="media">[Аудио{msg.duration ? ` ${formatDuration(msg.duration)}` : ''}]</div>
      case 'sticker':
        return msg.media
          ? <StickerThumb media={msg.media as Parameters<typeof mediaUrl>[0]} />
          : <div className="media">[Стикер]</div>
      case 'file':
        return <div className="media">[Файл{msg.size ? ` ${formatSize(msg.size)}` : ''}]</div>
      default:
        return null
    }
  }

  return (
    <div className={`bubble ${msg.out ? 'out' : 'in'}`} tabIndex={0}>
      {renderMedia()}
      {msg.text && <span className="bubble-text">{msg.text}</span>}
      <span className="bubble-time">{formatTime(msg.time)}</span>
    </div>
  )
}
