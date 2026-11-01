import { useRef } from 'react'
import type { RefObject } from 'react'
import './Composer.css'

interface Props {
  onSend: (text: string) => void
  /** Focused from the message list (ArrowDown past the last bubble) — Cloud Phone shows its IME */
  inputRef: RefObject<HTMLInputElement | null>
}

export default function Composer({ onSend, inputRef }: Props) {
  // Center on a focused field opens the native IME on Cloud Phone — so Enter-in-input
  // is only a desktop/sim path. The real send is the focusable ➤ button (↓ from the field).
  const sendRef = useRef<HTMLButtonElement>(null)

  const doSend = () => {
    const v = inputRef.current?.value.trim()
    if (v) {
      onSend(v)
      inputRef.current!.value = ''
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') doSend()
    // ArrowUp/Esc leaves the field — back to the message list
    if (e.key === 'ArrowUp' || e.key === 'Escape') e.currentTarget.blur()
    if (e.key === 'ArrowDown') sendRef.current?.focus()
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
      <button
        ref={sendRef}
        className="send"
        aria-label="Отправить"
        onClick={doSend}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') inputRef.current?.focus()
        }}
      >
        ➤
      </button>
    </div>
  )
}
