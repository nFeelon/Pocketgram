import { tg } from './client.ts'

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

const urls = new Set<string>()

/** Download media bytes over MTProto and expose them as a blob: object URL */
export async function mediaUrl(media: Parameters<typeof tg.downloadAsBuffer>[0]): Promise<string> {
  const buf = await tg.downloadAsBuffer(media)
  const blob = new Blob([buf as BlobPart])
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
