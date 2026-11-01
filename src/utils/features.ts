/** Cloud Phone capability detection — navigator.hasFeature on device, graceful fallback elsewhere */
export async function hasFeature(name: string): Promise<boolean> {
  try {
    return (await navigator.hasFeature?.(name)) ?? false
  } catch {
    return false
  }
}
