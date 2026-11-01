import { useEffect, useRef, useState } from 'react'
import { mediaUrl, revokeMediaUrl, MAX_PLAYABLE_BYTES } from '../tg/media.ts'
import { formatSize } from '../utils/format.ts'
import './MediaViewer.css'

interface Props {
  media: Parameters<typeof mediaUrl>[0]
  kind: 'photo' | 'video' | 'video_note' | 'voice' | 'audio'
  mimeType?: string
  size?: number
  onClose: () => void
}

/**
 * Full-screen viewer opened as a history entry — RSK/popstate closes it.
 * No MSE on Cloud Phone → video is fully buffered before playback; big
 * files fall back to a "download" hint.
 */
export default function MediaViewer({ media, kind, mimeType, size, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const tooBig = size !== undefined && size > MAX_PLAYABLE_BYTES
  const isAudio = kind === 'voice' || kind === 'audio'

  useEffect(() => {
    if (tooBig) return
    let alive = true
    let created: string | undefined
    void mediaUrl(media, mimeType).then((u) => {
      if (alive) setUrl((created = u))
      else revokeMediaUrl(u)
    })
    return () => {
      alive = false
      if (created) revokeMediaUrl(created)
    }
  }, [media, mimeType, tooBig])

  // native controls don't always map D-pad center → play; toggle it ourselves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !url || (e.target as HTMLElement)?.tagName === 'BUTTON') return
      const el = mediaRef.current
      if (el) void (el.paused ? el.play() : el.pause())
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
      {!tooBig && !url && (
        <p className="hint">Загрузка…{size ? ` (${formatSize(size)})` : ''}</p>
      )}
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
          className="full"
        />
      )}
      <button className="close-hint" onClick={onClose}>Назад</button>
    </div>
  )
}
