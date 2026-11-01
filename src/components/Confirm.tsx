import { useEffect } from 'react'
import './Confirm.css'

interface Props {
  text: string
  onConfirm: () => void
  onCancel: () => void
}

/** alert()/confirm() are not available on Cloud Phone — use this inline confirm instead */
export default function Confirm({ text, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onConfirm()
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="confirm" role="alertdialog" aria-modal>
      <p>{text}</p>
      <p className="hint">Enter — да · Esc — нет</p>
    </div>
  )
}
