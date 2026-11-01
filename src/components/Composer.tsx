import type { RefObject } from 'react'
import './Composer.css'

interface Props {
  onSend: (text: string) => void
  /** Focused from the message list (ArrowDown past the last bubble) — Cloud Phone shows its IME */
  inputRef: RefObject<HTMLInputElement | null>
}

export default function Composer({ onSend, inputRef }: Props) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value.trim()
      if (value) {
        onSend(value)
        inputRef.current!.value = ''
      }
    }
    // ArrowUp/Esc leaves the field — back to the message list
    if (e.key === 'ArrowUp' || e.key === 'Escape') e.currentTarget.blur()
  }

  return (
    <div className="composer">
      <input
        ref={inputRef}
        type="text"
        placeholder="Сообщение…"
        onKeyDown={handleKeyDown}
        aria-label="Сообщение"
      />
    </div>
  )
}
