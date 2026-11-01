import { useEffect } from 'react'
import MenuIcon from '../assets/icons/menu.svg?react'
import BackIcon from '../assets/icons/back.svg?react'
import SelectIcon from '../assets/icons/select.svg?react'
import './SoftKeyBar.css'

export type SoftKeyPosition = 'start' | 'center' | 'end'
export type SoftKeyIcon = 'menu' | 'back' | 'select'

export interface SoftKeyButton {
  text?: string
  icon?: SoftKeyIcon
  title?: string
}

function getIconFromName(name: SoftKeyIcon) {
  switch (name) {
    case 'menu': return <MenuIcon />
    case 'back': return <BackIcon />
    case 'select': return <SelectIcon />
  }
}

interface Props {
  buttons?: Partial<Record<SoftKeyPosition, SoftKeyButton>>
  onSoftKeyClick?: (position: SoftKeyPosition) => void
}

export default function SoftKeyBar({ buttons = {}, onSoftKeyClick = () => {} }: Props) {
  useEffect(() => {
    const handleEvent = (event: KeyboardEvent) => {
      // typing in an input — let the field's own Enter/Esc handling work, don't fire soft keys
      if ((event.target as HTMLElement)?.tagName === 'INPUT') return
      switch (event.key) {
        /* Left Soft Key (LSK) */
        case 'Escape': return onSoftKeyClick('start')
        case 'Enter': return onSoftKeyClick('center')
        /* RSK cannot be intercepted — it is history.back() */
      }
    }
    window.addEventListener('keydown', handleEvent)
    return () => window.removeEventListener('keydown', handleEvent)
  })

  const renderButton = (position: SoftKeyPosition) => {
    const cfg = buttons[position]
    if (!cfg) {
      return <button key={position} className="disabled" disabled aria-disabled="true" />
    }
    return (
      <button key={position} onClick={() => onSoftKeyClick(position)} title={cfg.title}>
        {cfg.icon && getIconFromName(cfg.icon)}
        {cfg.text}
      </button>
    )
  }

  return (
    <footer className="softkey-bar">
      {(['start', 'center', 'end'] as const).map(renderButton)}
    </footer>
  )
}
