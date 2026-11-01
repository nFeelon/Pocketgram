import { tg } from './client.ts'
import type { UserStatus, Peer } from '@mtcute/web'
import type { DialogType } from '../store/dialogs.ts'
import { formatTime } from '../utils/format.ts'

const STATUS_LABEL: Record<UserStatus, string> = {
  online: 'в сети',
  offline: 'давно',
  recently: 'был недавно',
  within_week: 'был на неделе',
  within_month: 'был в этом месяце',
  long_time_ago: 'давно',
  bot: 'бот',
}

/** Last-seen text for a user dialog header ('был в HH:MM' today, 'был DD.MM' before) */
export function statusText(status: UserStatus, lastOnline: Date | null): string {
  if (status === 'offline' && lastOnline) {
    if (lastOnline.toDateString() === new Date().toDateString()) {
      return `был в ${formatTime(lastOnline.getTime() / 1000)}`
    }
    const dd = String(lastOnline.getDate()).padStart(2, '0')
    const mm = String(lastOnline.getMonth() + 1).padStart(2, '0')
    return `был ${dd}.${mm}`
  }
  return STATUS_LABEL[status]
}

export async function getUserStatusText(userId: number): Promise<string> {
  const [u] = await tg.getUsers(userId)
  return u ? statusText(u.status, u.lastOnline) : ''
}

/** user/group/channel/self from a dialog's peer — shared by loadDialogs and peerInfo */
export function dialogTypeOf(p?: { type?: string; isSelf?: boolean; chatType?: string }): DialogType {
  if (!p) return 'user'
  return p.type === 'user' ? (p.isSelf ? 'self' : 'user') : p.chatType === 'channel' ? 'channel' : 'group'
}

export interface PeerMeta {
  title: string
  type: DialogType
  draft?: string
  readOutbox: number
}

/** Title/type/draft/readOutbox for a peer that isn't in the dialog list (opened from Contacts) */
export async function peerInfo(peerId: string): Promise<PeerMeta> {
  const [d] = await tg.getPeerDialogs(Number(peerId))
  return {
    title: d?.peer.displayName ?? 'Чат',
    type: dialogTypeOf(d?.peer as Peer | undefined),
    draft: d?.draftMessage?.text,
    readOutbox: d?.lastReadOutgoing ?? 0,
  }
}
