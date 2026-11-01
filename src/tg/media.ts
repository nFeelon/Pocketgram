import { tg } from './client.ts'
import { cachedBlob } from './cache.ts'

export type MediaKind = 'photo' | 'video' | 'video_note' | 'voice' | 'audio' | 'sticker' | 'file' | 'none'

interface MediaLike {
  type?: string
  /** Video.isRound — round video notes ("кружочки") */
  isRound?: boolean
}

export function mediaKind(media: MediaLike | null | undefined): MediaKind {
  switch (media?.type) {
    case 'photo': return 'photo'
    case 'video': return media.isRound ? 'video_note' : 'video'
    case 'voice': return 'voice'
    case 'audio': return 'audio'
    case 'sticker': return 'sticker'
    case 'document': return 'file'
    default: return 'none'
  }
}

/** Best-effort preview frame ('m' = 320 box, 's' = 100 box); null when the media has none */
export function thumbOf(media: unknown): Parameters<typeof tg.downloadAsBuffer>[0] | null {
  const m = media as {
    getThumbnail?: (t: string) => Parameters<typeof tg.downloadAsBuffer>[0] | null
  } | null
  return m?.getThumbnail?.('m') ?? m?.getThumbnail?.('s') ?? null
}

const urls = new Set<string>()

/** Download media bytes over MTProto as a Blob — goes through the IndexedDB
 *  cache by uniqueFileId, so re-opened media doesn't re-download. */
export async function mediaBlob(
  media: Parameters<typeof tg.downloadAsBuffer>[0],
  mimeType = 'application/octet-stream',
): Promise<Blob> {
  const fetch = async () => {
    const buf = await tg.downloadAsBuffer(media)
    return new Blob([buf as BlobPart], { type: mimeType })
  }
  return cachedBlob((media as { uniqueFileId?: string }).uniqueFileId ?? null, fetch)
}

/** Download media bytes over MTProto and expose them as a blob: object URL.
 *  Pass the media's mimeType — media elements may refuse to play a typeless blob. */
export async function mediaUrl(
  media: Parameters<typeof tg.downloadAsBuffer>[0],
  mimeType = 'application/octet-stream',
): Promise<string> {
  const blob = await mediaBlob(media, mimeType)
  const url = URL.createObjectURL(blob)
  urls.add(url)
  return url
}

export function revokeMediaUrl(url: string) {
  urls.delete(url)
  URL.revokeObjectURL(url)
}

/** Blob limit on Cloud Phone IndexedDB is 50 MB; above that offer a download instead */
export const MAX_PLAYABLE_BYTES = 48 * 1024 * 1024
