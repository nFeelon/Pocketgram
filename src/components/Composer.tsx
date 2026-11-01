import { useRef } from 'react'
import './Composer.css'

interface Props {
  onSend: (text: string) => void
  /** Cloud Phone shows its IME when the input is focused */
}

export default function Composer({ onSend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value.trim()
      if (value) {
        onSend(value)
        inputRef.current!.value = ''
      }
    }
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
