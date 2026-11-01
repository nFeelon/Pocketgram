import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../store/settings.ts'
import './Marquee.css'

interface Props {
  text: string
  /** run only while an ancestor row is `.focused` (message previews) */
  whenFocused?: boolean
}

/** Feature-phone marquee: ping-pong scroll of overflowing text. Distance is
 *  measured per element; animation runs only when the text actually overflows
 *  (and, with whenFocused, only while the row is focused). */
export default function Marquee({ text, whenFocused }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(0)
  // font size changes text width without touching `text` — re-measure on it
  const font = useSettingsStore((s) => s.font)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setOverflow(Math.max(0, el.scrollWidth - el.clientWidth))
  }, [text, font])

  return (
    <span
      ref={ref}
      className={`mq${whenFocused ? ' mq-wf' : ''}${overflow ? ' has-overflow' : ''}`}
      style={{ ['--mx' as string]: `${overflow}px` }}
    >
      <span className="mq-inner">{text}</span>
    </span>
  )
}
