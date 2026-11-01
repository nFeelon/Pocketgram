import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import React from 'react'
import { useNavigate } from 'react-router'
import './OptionsMenu.css'

interface Props {
  visible: boolean
  children: ReactNode // falsy children (e.g. {flag && <button>}) are dropped
  onMenuItemSelected?: (child: ReactElement, index: number) => void
  onClose?: () => void
}

/**
 * Full-screen LSK menu. Opens as a history entry (#menu) so RSK/popstate closes it for free.
 */
export default function OptionsMenu({ visible, children, onMenuItemSelected = () => {}, onClose = () => {} }: Props) {
  const menuRef = useRef<HTMLElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const navigate = useNavigate()
  const menuItems = React.Children.toArray(children) as ReactElement<React.HTMLAttributes<HTMLElement>>[]

  // Push a history entry when the menu opens → RSK (popstate) closes it
  useEffect(() => {
    if (visible && !location.hash.includes('#menu')) navigate('#menu')
  }, [visible, navigate])

  useEffect(() => {
    const handlePopState = () => {
      if (!location.hash.includes('#menu')) onClose()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || !menuRef.current) return
      const items = menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]')
      if (!items.length) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          // ↓ past the last item leaves the modal — focus returns to whatever had it
          // (e.g. the softkey bar), matching the YouTube-style bottom-sheet model
          if (focusedIndex >= items.length - 1) {
            if (location.hash.includes('#menu')) navigate(-1)
            else onClose()
          } else setFocusedIndex((prev) => (prev + 1) % items.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case 'Enter':
          e.preventDefault()
          items[focusedIndex]?.click()
          onMenuItemSelected(menuItems[focusedIndex], focusedIndex)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    items[focusedIndex]?.focus()
  }, [focusedIndex])

  if (!visible) return null

  return (
    <menu ref={menuRef} role="menu" className="options-menu">
      {menuItems.map((child, index) =>
        React.cloneElement(child, {
          role: 'menuitem',
          tabIndex: index,
          className: [child.props.className, index === focusedIndex ? 'focused' : '']
            .filter(Boolean)
            .join(' '),
        }),
      )}
    </menu>
  )
}
