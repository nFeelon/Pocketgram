// pulls in the official Cloud Phone global declarations (volumeManager, 'back' event, x-puffin-*)
import type {} from '@cloudmosa-inc/cloudphone-types'

/** Cloud Phone capability detection — navigator.hasFeature on device, graceful fallback elsewhere */
export async function hasFeature(name: string): Promise<boolean> {
  try {
    return (await navigator.hasFeature?.(name)) ?? false
  } catch {
    return false
  }
}
