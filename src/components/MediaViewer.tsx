import { useEffect, useRef, useState } from 'react'
import { mediaBlob, mediaChunks, mediaKey, MAX_PLAYABLE_BYTES } from '../tg/media.ts'
import { getCachedBlob, putCachedBlob } from '../tg/cache.ts'
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

// play starts once this much of the file is buffered — faststart MP4 plays from a prefix
const START_BYTES = 768 * 1024

/**
 * Full-screen viewer opened as a history entry — RSK/popstate closes it.
 * No MSE on Cloud Phone → instead of real streaming the blob URL is rebuilt as
 * chunks arrive: playback starts at ~768KB and the blob keeps growing behind
 * the playhead. ↑↓ route through volumeManager (system HUD).
 */
export default function MediaViewer({ media, kind, mimeType, size, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [pct, setPct] = useState(-1) // -1 = total unknown
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const pendingSeek = useRef<{ t: number; play: boolean } | null>(null)
  const swapRef = useRef<() => void>(() => {})
  const loaded = useRef({ bytes: 0, total: 0 }) // for the seek clamp — CBR estimate
  const tooBig = size !== undefined && size > MAX_PLAYABLE_BYTES
  const isAudio = kind === 'voice' || kind === 'audio'
  const stream = kind !== 'photo'

  useEffect(() => {
    if (tooBig) return
    let alive = true
    let created: string | undefined
    const chunks: Uint8Array[] = []
    let bytes = 0
    let urlBytes = 0

    const open = (blob: Blob) => {
      if (!alive) return
      const el = mediaRef.current
      // el.ended fires on the truncated blob's tail — treat it as "still playing"
      pendingSeek.current = el ? { t: el.currentTime, play: !el.paused || el.ended } : null
      if (created) URL.revokeObjectURL(created)
      urlBytes = bytes || blob.size
      setUrl((created = URL.createObjectURL(blob)))
    }

    /** rebuild the blob URL with everything downloaded so far (playback keeps position) */
    const swapIfGrown = () => {
      if (bytes > urlBytes) open(new Blob(chunks as BlobPart[], { type: mimeType }))
    }
    swapRef.current = swapIfGrown

    void (async () => {
      const key = mediaKey(media)
      const hit = await getCachedBlob(key)
      if (!alive) return
      if (hit) {
        bytes = hit.size
        loaded.current = { bytes: hit.size, total: hit.size }
        open(hit)
        return
      }
      if (!stream) {
        const blob = await mediaBlob(media, mimeType, (d, t) => {
          if (alive) setPct(Number.isFinite(t) && t > 0 ? Math.round((d / t) * 100) : -1)
        })
        if (alive) open(blob)
        return
      }
      loaded.current.total = size ?? 0
      for await (const chunk of mediaChunks(media)) {
        if (!alive) return
        chunks.push(chunk)
        bytes += chunk.length
        loaded.current.bytes = bytes
        if (size && size > 0) setPct(Math.min(99, Math.round((bytes / size) * 100)))
        if (urlBytes === 0 && bytes >= START_BYTES) swapIfGrown()
      }
      const full = new Blob(chunks as BlobPart[], { type: mimeType })
      putCachedBlob(key, full)
      swapIfGrown()
      setPct(100)
    })().catch((e) => {
      console.error(e)
      if (alive) setErr('Не удалось загрузить медиа')
    })

    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [media, mimeType, tooBig, stream, size])

  const onMediaError = () => {
    const code = mediaRef.current?.error?.code
    setErr(`Медиа не поддерживается (код ${code ?? '?'})`)
  }

  // playhead reached the end of the grown blob → extend it and keep playing
  const onStarved = () => swapRef.current()
  const onTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget
    if (el.duration - el.currentTime < 1.5) swapRef.current()
  }
  // faststart MP4 reports the FULL duration — the user can seek into bytes we
  // haven't fetched yet and stall forever; clamp to the downloaded estimate
  const onSeeking = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget
    const { bytes, total } = loaded.current
    if (!Number.isFinite(el.duration) || !total || bytes >= total) return
    const maxT = el.duration * (bytes / total)
    if (el.currentTime > maxT) el.currentTime = Math.max(0, maxT - 0.5)
  }
  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget
    const seek = pendingSeek.current
    pendingSeek.current = null
    if (seek) {
      if (Number.isFinite(el.duration)) el.currentTime = Math.min(seek.t, Math.max(0, el.duration - 0.1))
      if (!seek.play) return // keep the paused state across a blob swap
    }
    void el.play().catch(() => {})
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

  const mediaHandlers = {
    ref: (el: HTMLVideoElement | HTMLAudioElement | null) => {
      mediaRef.current = el
    },
    controls: true,
    autoPlay: true,
    onError: onMediaError,
    onLoadedMetadata,
    onWaiting: onStarved,
    onStalled: onStarved,
    onEnded: () => swapRef.current(),
    onTimeUpdate,
    onSeeking,
    // autoPlay may be blocked without a fresh gesture — retry on ready
    onCanPlay: (e: React.SyntheticEvent<HTMLMediaElement>) => void e.currentTarget.play().catch(() => {}),
  }

  return (
    <div className="media-viewer" role="dialog" aria-modal>
      {tooBig && (
        <p className="hint">
          Файл слишком большой ({size ? formatSize(size) : '∞'}) — скачайте через меню.
        </p>
      )}
      {!tooBig && !url && !err && (
        <p className="hint">
          Загрузка…{pct >= 0 ? ` ${pct}%` : size ? ` (${formatSize(size)})` : ''}
        </p>
      )}
      {err && <p className="hint">{err}</p>}
      {url && kind === 'photo' && <img src={url} alt="" className="full" />}
      {url && isAudio && <audio {...mediaHandlers} src={url} className="audio" />}
      {url && !isAudio && kind !== 'photo' && (
        <video {...mediaHandlers} src={url} playsInline className="full" />
      )}
      {url && !err && pct >= 0 && pct < 100 && stream && <p className="hint small">…{pct}%</p>}
      {url && !err && <p className="hint small">центр — ▶/⏸ · ↑↓ — громкость</p>}
      <button className="close-hint" onClick={onClose}>
        Назад
      </button>
    </div>
  )
}
