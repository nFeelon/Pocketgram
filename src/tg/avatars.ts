import { tg } from './client.ts'
import { mediaBlob } from './media.ts'
import { logErr } from './auth.ts'

type Location = Parameters<typeof tg.downloadAsBuffer>[0]

// peerId → photo fetch (promise dedupes concurrent rows); blob URLs live for the session —
// avatar files are a few KB and revoking would break re-mounted lists
const cache = new Map<string, Promise<string | null>>()

/** Small profile photo as a blob URL. Pass the peer's `photo.small` FileLocation when the
 *  caller already holds the peer (dialog rows do) — skips an extra getUsers/getChat RPC.
 *  null when the peer has no photo or the fetch failed */
export function avatarUrl(peerId: string, loc?: Location | null): Promise<string | null> {
  let p = cache.get(peerId)
  if (!p) {
    p = (loc ? download(loc) : fetchAvatar(peerId)).catch((e) => {
      logErr(e)
      return null
    })
    cache.set(peerId, p)
  }
  return p
}

// through the IDB media cache — avatars survive restarts without re-downloading
async function download(loc: Location): Promise<string> {
  return URL.createObjectURL(await mediaBlob(loc, 'image/jpeg'))
}

async function fetchAvatar(peerId: string): Promise<string | null> {
  const id = Number(peerId)
  const peer = id > 0 ? (await tg.getUsers(id))[0] : await tg.getChat(id)
  return peer?.photo?.small ? download(peer.photo.small) : null
}
