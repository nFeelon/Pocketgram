import { useEffect } from 'react'
import { useNavigate } from 'react-router'

// HashRouter: '#/chat/1#menu' — overlay marker sits at the END of location.hash
const OVERLAY = /#(menu|viewer|search|topics)$/

/**
 * Overlay hashes left in the URL each eat one hardware-back press: RSK pops the dead
 * entry, the screen doesn't change → "назад не работает". Clear them on screen mount.
 * keep='#menu' on screens whose menu state mirrors the hash (Chat/ChatList re-open it).
 */
export function useCleanHash(keep?: string) {
  const navigate = useNavigate()
  useEffect(() => {
    if (OVERLAY.test(location.hash) && !(keep && location.hash.endsWith(keep))) {
      // strip only the overlay suffix — under HashRouter the route lives in the
      // hash itself, and navigating to pathname('/') would dump the user to the list
      const clean = location.hash.replace(OVERLAY, '').replace(/^#/, '') || '/'
      navigate(clean, { replace: true })
    }
  }, [keep, navigate])
}
