import type { RefObject } from 'react'
import { useChatStore } from '../store/chat.ts'
import './Composer.css'

interface Props {
  onSend: (text: string) => void
  /** Focused from the message list (ArrowDown past the last bubble) — Cloud Phone shows its IME */
  inputRef: RefObject<HTMLInputElement | null>
  /** ArrowDown on the send button → softkey bar; ArrowUp on the bar returns here */
  sendRef: RefObject<HTMLButtonElement | null>
  onBelow: () => void
  /** server-side draft — set once via defaultValue (input stays uncontrolled) */
  initialValue?: string
  /** every edit (and the post-send clear) is mirrored so unmount can persist it */
  onDraftChange?: (v: string) => void
}

export default function Composer({ onSend, inputRef, sendRef, onBelow, initialValue, onDraftChange }: Props) {
  const compose = useChatStore((s) => s.compose)
  // Center on a focused field opens the native IME on Cloud Phone — so Enter-in-input
  // is only a desktop/sim path. The real send is the focusable ➤ button (↓ from the field).
  const doSend = () => {
    const v = inputRef.current?.value.trim()
    if (v) {
      onSend(v)
      inputRef.current!.value = ''
      onDraftChange?.('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') doSend()
    // ArrowUp/Esc leaves the field — back to the message list
    if (e.key === 'ArrowUp' || e.key === 'Escape') e.currentTarget.blur()
    if (e.key === 'Escape' && compose) useChatStore.getState().setCompose(null)
    if (e.key === 'ArrowDown') sendRef.current?.focus()
  }

  return (
    <div className="composer-wrap">
      {compose && (
        <div className="compose-plate">
          {compose.mode === 'reply' ? '↩' : '✎'} {compose.text}
        </div>
      )}
      <div className="composer">
        <input
          ref={inputRef}
          type="text"
          placeholder="Сообщение…"
          defaultValue={initialValue}
          onInput={(e) => onDraftChange?.(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          aria-label="Сообщение"
        />
        <button
          ref={sendRef}
          className="send"
          aria-label="Отправить"
          onClick={doSend}
          onKeyDown={(e) => {
            // arrows handled here — don't let them also reach the screen's nav listener
            if (e.key === 'ArrowUp') inputRef.current?.focus()
            else if (e.key === 'ArrowDown') onBelow()
            if (e.key.startsWith('Arrow')) e.stopPropagation()
          }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
