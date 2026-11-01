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
      const tag = (event.target as HTMLElement)?.tagName
      // inputs own their keys; Enter on a focused <button> already clicks it natively —
      // mapping it to 'center' too would fire the action twice
      if (tag === 'INPUT' || (tag === 'BUTTON' && event.key === 'Enter')) return
      switch (event.key) {
        /* Left Soft Key (LSK) */
        case 'Escape':
        case 'SoftLeft':
          return onSoftKeyClick('start')
        case 'Enter': return onSoftKeyClick('center')
        /* Right Soft Key candidates — some builds emit a key instead of history.back() */
        case 'Backspace':
        case 'SoftRight':
        case 'BrowserBack':
        case 'GoBack':
          return onSoftKeyClick('end')
      }
    }
    // Cloud Phone RSK isn't a keyboard key — it's the 'back' window event
    // (default: history.back or app exit). HashRouter keeps route + overlay in
    // location.hash ('#/chat/1#menu') — at the root list ('#/') with no overlay
    // the default run IS the user asking to quit, so we let it through.
    const handleBack = (e: Event) => {
      const h = location.hash
      const atRoot = h === '' || h === '#' || h === '#/'
      if (atRoot && !/#(menu|viewer|search|topics)$/.test(h)) return
      e.preventDefault()
      onSoftKeyClick('end')
    }
    window.addEventListener('keydown', handleEvent)
    window.addEventListener('back', handleBack)
    return () => {
      window.removeEventListener('keydown', handleEvent)
      window.removeEventListener('back', handleBack)
    }
  })

  const renderButton = (position: SoftKeyPosition) => {
    const cfg = buttons[position]
    if (!cfg) {
      return <button key={position} data-pos={position} className="disabled" disabled aria-disabled="true" />
    }
    return (
      <button key={position} data-pos={position} onClick={() => onSoftKeyClick(position)} title={cfg.title}>
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
