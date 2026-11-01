import { useEffect, useState } from 'react'
import { mediaUrl, MAX_PLAYABLE_BYTES } from '../tg/media.ts'
import { formatSize } from '../utils/format.ts'
import './MediaViewer.css'

interface Props {
  media: Parameters<typeof mediaUrl>[0]
  kind: 'photo' | 'video' | 'video_note'
  size?: number
  onClose: () => void
}

/**
 * Full-screen viewer opened as a history entry — RSK/popstate closes it.
 * No MSE on Cloud Phone → video is fully buffered before playback; big
 * files fall back to a "download" hint.
 */
export default function MediaViewer({ media, kind, size, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const tooBig = size !== undefined && size > MAX_PLAYABLE_BYTES

  useEffect(() => {
    if (tooBig) return
    let alive = true
    void mediaUrl(media).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [media, tooBig])

  return (
    <div className="media-viewer" role="dialog" aria-modal>
      {tooBig && (
        <p className="hint">
          Файл слишком большой ({size ? formatSize(size) : '∞'}) — скачайте через меню.
        </p>
      )}
      {!tooBig && !url && <p className="hint">Загрузка…</p>}
      {url && kind === 'photo' && <img src={url} alt="" className="full" />}
      {url && kind !== 'photo' && (
        <video src={url} controls autoPlay className="full" />
      )}
      <button className="close-hint" onClick={onClose}>Назад</button>
    </div>
  )
}
