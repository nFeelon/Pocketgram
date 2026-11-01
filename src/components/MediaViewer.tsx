import { useEffect, useRef, useState } from 'react'
import { mediaBlob, MAX_PLAYABLE_BYTES } from '../tg/media.ts'
import { formatSize } from '../utils/format.ts'
import './MediaViewer.css'

declare global {
  interface Navigator {
    /** Cloud Phone system volume HUD — HTMLMediaElement.volume is a no-op there */
    volumeManager?: { requestShow(): void; requestUp(): void; requestDown(): void }
  }
}

interface Props {
  media: Parameters<typeof mediaBlob>[0]
  kind: 'photo' | 'video' | 'video_note' | 'voice' | 'audio'
  mimeType?: string
  size?: number
  onClose: () => void
}

/**
 * Full-screen viewer opened as a history entry — RSK/popstate closes it.
 * No MSE on Cloud Phone → video is fully buffered before playback; big
 * files fall back to a "download" hint. ↑↓ route through volumeManager
 * (system HUD) since element.volume does nothing on Cloud Phone.
 */
export default function MediaViewer({ media, kind, mimeType, size, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const tooBig = size !== undefined && size > MAX_PLAYABLE_BYTES
  const isAudio = kind === 'voice' || kind === 'audio'

  useEffect(() => {
    if (tooBig) return
    let alive = true
    let created: string | undefined
    void mediaBlob(media, mimeType)
      .then((blob) => {
        if (alive) setUrl((created = URL.createObjectURL(blob)))
      })
      .catch((e) => {
        console.error(e)
        if (alive) setErr('Не удалось загрузить медиа')
      })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [media, mimeType, tooBig])

  const onMediaError = () => {
    const code = mediaRef.current?.error?.code
    setErr(`Медиа не поддерживается (код ${code ?? '?'})`)
  }

  // native controls don't always map D-pad keys — handle them at window level:
  // center/space/MediaPlayPause toggles, ↑↓ = volume (system HUD when available)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!url || (e.target as HTMLElement)?.tagName === 'BUTTON') return
      const el = mediaRef.current
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'MediaPlayPause') {
        e.preventDefault()
        if (el) void (el.paused ? el.play() : el.pause())
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const vm = navigator.volumeManager
        if (vm) (e.key === 'ArrowUp' ? vm.requestUp() : vm.requestDown())
        else if (el) el.volume = Math.min(1, Math.max(0, el.volume + (e.key === 'ArrowUp' ? 0.15 : -0.15)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url])

  return (
    <div className="media-viewer" role="dialog" aria-modal>
      {tooBig && (
        <p className="hint">
          Файл слишком большой ({size ? formatSize(size) : '∞'}) — скачайте через меню.
        </p>
      )}
      {!tooBig && !url && !err && (
        <p className="hint">Загрузка…{size ? ` (${formatSize(size)})` : ''}</p>
      )}
      {err && <p className="hint">{err}</p>}
      {url && kind === 'photo' && <img src={url} alt="" className="full" />}
      {url && isAudio && (
        <audio
          ref={(el) => {
            mediaRef.current = el
          }}
          src={url}
          controls
          autoPlay
          className="audio"
          onError={onMediaError}
          // autoPlay may be blocked without a fresh gesture — retry on ready
          onCanPlay={(e) => void e.currentTarget.play().catch(() => {})}
        />
      )}
      {url && !isAudio && kind !== 'photo' && (
        <video
          ref={(el) => {
            mediaRef.current = el
          }}
          src={url}
          controls
          autoPlay
          playsInline
          className="full"
          onError={onMediaError}
          onCanPlay={(e) => void e.currentTarget.play().catch(() => {})}
        />
      )}
      {url && !err && <p className="hint small">центр — ▶/⏸ · ↑↓ — громкость</p>}
      <button className="close-hint" onClick={onClose}>
        Назад
      </button>
    </div>
  )
}
