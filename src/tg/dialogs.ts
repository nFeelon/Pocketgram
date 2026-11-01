import { tg } from './client.ts'
import { dialogTypeOf } from './peers.ts'
import { messagePreview } from './messages.ts'
import { useDialogsStore } from '../store/dialogs.ts'
import type { DialogEntry } from '../store/dialogs.ts'
import type { Dialog } from '@mtcute/web'

function entryOf(d: Dialog): DialogEntry {
  const m = d.lastMessage
  return {
    id: String(d.peer.id),
    title: d.peer.displayName,
    type: dialogTypeOf(d.peer),
    preview: messagePreview(m),
    time: m ? Math.floor(m.date.getTime() / 1000) : 0,
    unread: d.unreadCount,
    pinned: d.isPinned,
    readOutbox: d.lastReadOutgoing,
    outId: m?.isOutgoing ? m.id : undefined,
    draft: d.draftMessage?.text,
    isForum: (d.peer as { isForum?: boolean }).isForum ?? false,
    photo: (d.peer as { photo?: { small?: Parameters<typeof tg.downloadAsBuffer>[0] } }).photo?.small,
  }
}

/** Load the dialog list from Telegram into the store (initial load + «Обновить») */
export async function loadDialogs(limit = 100) {
  const list: DialogEntry[] = []
  for await (const d of tg.iterDialogs({ limit })) {
    list.push(entryOf(d))
  }
  useDialogsStore.getState().setDialogs(list)
}

/** Fetch and upsert one dialog row — a message arrived from a peer the first page missed */
export async function loadDialog(peerId: string) {
  const [d] = await tg.getPeerDialogs(Number(peerId))
  if (d) useDialogsStore.getState().upsert(entryOf(d))
}
