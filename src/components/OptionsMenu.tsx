import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import React from 'react'
import { useNavigate } from 'react-router'
import { autoFocusFirstFocusable } from '../utils/focus.ts'
import './OptionsMenu.css'

interface Props {
  visible: boolean
  children: ReactElement[]
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

  // Push a history entry when the menu opens → RSK (popstate) closes it
  useEffect(() => {
    if (visible) navigate('#menu')
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
          setFocusedIndex((prev) => (prev + 1) % items.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case 'Enter':
          e.preventDefault()
          items[focusedIndex]?.click()
          onMenuItemSelected(children[focusedIndex], focusedIndex)
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

  useEffect(() => autoFocusFirstFocusable(menuRef.current), [])

  if (!visible) return null

  return (
    <menu ref={menuRef} role="menu" className="options-menu">
      {React.Children.map(children, (child, index) =>
        React.cloneElement(child as ReactElement<React.HTMLAttributes<HTMLElement>>, {
          role: 'menuitem',
          tabIndex: index,
          className: index === focusedIndex ? 'focused' : '',
        }),
      )}
    </menu>
  )
}
