import { initial } from '../utils/format.ts'
import './Avatar.css'

const PALETTE = ['#e17076', '#eda86c', '#a695e7', '#7bc862', '#6ec9cb', '#65aadd', '#ee7aae']

function colorFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export default function Avatar({ id, title }: { id: string; title: string }) {
  // TODO: load real profile photos via tg.downloadAsBuffer → blob URL, cache in IndexedDB
  return (
    <span className="avatar" style={{ background: colorFor(id) }} aria-hidden>
      {initial(title)}
    </span>
  )
}
