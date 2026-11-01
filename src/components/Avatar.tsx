import { useEffect, useState } from 'react'
import { avatarUrl } from '../tg/avatars.ts'
import { initial } from '../utils/format.ts'
import './Avatar.css'

const PALETTE = ['#e17076', '#eda86c', '#a695e7', '#7bc862', '#6ec9cb', '#65aadd', '#ee7aae']

export function colorFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export default function Avatar({
  id,
  title,
  photo,
}: {
  id: string
  title: string
  /** peer.photo.small FileLocation — callers holding the peer pass it to skip a resolve RPC */
  photo?: Parameters<typeof avatarUrl>[1]
}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void avatarUrl(id, photo).then((u) => {
      if (alive) setSrc(u)
    })
    return () => {
      alive = false
    }
  }, [id, photo])
  return (
    <span className="avatar" style={{ background: src ? 'transparent' : colorFor(id) }} aria-hidden>
      {src ? <img src={src} alt="" /> : initial(title)}
    </span>
  )
}
