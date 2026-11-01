import { tg } from './client.ts'
import { mediaKind } from './media.ts'
import type { MediaKind } from './media.ts'
import { useChatStore } from '../store/chat.ts'
import type { ChatMessage } from '../store/chat.ts'
import { useDialogsStore } from '../store/dialogs.ts'
import { notifyIncoming } from './notify.ts'
import { logErr } from './auth.ts'
import type { Message } from '@mtcute/web'

const tsOf = (m: { date: Date }) => Math.floor(m.date.getTime() / 1000)

// unmarked (non-channel) peer ids are positive users/chats; mtcute marks channels as -1e12 - id
const UNMARKED_PEER_MIN = -1e12

const LABEL: Partial<Record<MediaKind, string>> = {
  photo: '[Фото]',
  video: '[Видео]',
  video_note: '[Видеосообщение]',
  voice: '[Голосовое]',
  audio: '[Аудио]',
  sticker: '[Стикер]',
  file: '[Файл]',
}

export function mediaLabel(kind: MediaKind): string {
  return LABEL[kind] ?? ''
}

// search pages carry a bare message id as next — box it to fit the shared nextOffset shape
const nextOffsetOf = (page: { next?: unknown }, threadId: number | null) =>
  page.next == null
    ? null
    : threadId
      ? { id: page.next as number, date: 0 }
      : (page.next as { id: number; date: number })

interface PollLike {
  question?: string
  answers?: { text?: string; voters?: number; chosen?: boolean }[]
  isClosed?: boolean
}

/** Read-only poll rendering — voting isn't supported on the keypad build */
function pollText(p: PollLike): string {
  const opts = (p.answers ?? []).map(
    (a) => `· ${a.chosen ? '✓ ' : ''}${a.text ?? ''}${a.voters ? ` (${a.voters})` : ''}`,
  )
  return `Опрос: ${p.question ?? ''}\n${opts.join('\n')}${p.isClosed ? '\n(завершён)' : ''}`
}

/** One-line summary for dialog rows and service messages */
export function messagePreview(m: Message | null | undefined): string {
  if (!m) return ''
  if (m.isService) return '—'
  const media = m.media as { type?: string; question?: string } | null
  if (media?.type === 'poll') return `[Опрос] ${media.question ?? ''}`
  return m.text || mediaLabel(mediaKind(m.media)) || ''
}

export function mapMessage(m: Message): ChatMessage {
  const media = m.media as {
    type?: string
    isRound?: boolean
    isAnimation?: boolean
    mimeType?: string
    duration?: number
    waveform?: number[]
    fileSize?: number
    sourceType?: string
  } | null
  const kind = m.isService ? 'none' : mediaKind(media)
  const sender = m.sender as { id?: number; displayName?: string } | null
  const reply = m.replyToMessage
  const poll = media?.type === 'poll' ? (media as unknown as PollLike) : null
  return {
    id: m.id,
    out: m.isOutgoing,
    text: m.isService ? messagePreview(m) : m.text || (poll ? pollText(poll) : ''),
    time: tsOf(m),
    mediaKind: kind,
    // tgs/webm stickers can't play inline — the [Стикер] placeholder stands in
    media: kind === 'sticker' && media?.sourceType !== 'static' ? undefined : (media ?? undefined),
    mimeType: kind === 'photo' ? 'image/jpeg' : media?.mimeType,
    duration: media?.duration,
    waveform: media?.waveform,
    size: media?.fileSize,
    senderId: sender?.id,
    senderName: sender?.displayName,
    edited: !!m.editDate && !m.hideEditMark,
    replyTo: reply ? { id: reply.id, text: reply.quoteText } : undefined,
    isGif: media?.isAnimation,
    reacts: (m.reactions?.reactions ?? []).map((r) => ({
      // custom emoji arrive as a document id, not a glyph — show a placeholder
      e: typeof r.emoji === 'string' ? r.emoji : '☺',
      n: r.count,
      mine: r.order != null,
    })),
  }
}

export async function loadInitial(peerId: string) {
  const { threadId } = useChatStore.getState()
  // topic feeds go through search — getHistory has no thread filter
  const page = threadId
    ? await tg.searchMessages({ chatId: Number(peerId), query: '', threadId, limit: 30 })
    : await tg.getHistory(Number(peerId), { limit: 30 })
  // user switched chats while the page was in flight — drop it
  if (useChatStore.getState().peerId !== peerId) return
  useChatStore.getState().setMessages(page.map(mapMessage).reverse(), nextOffsetOf(page, threadId))
  useChatStore.setState({ detached: false })
  void markRead(peerId)
}

/** Replace the feed with ~30 messages around msgId (search / reply-origin jump) */
export async function jumpTo(peerId: string, msgId: number): Promise<number> {
  const page = await tg.getHistory(Number(peerId), {
    offset: { id: msgId, date: 0 },
    addOffset: -15,
    limit: 30,
  })
  if (useChatStore.getState().peerId !== peerId) return -1
  const list = page.map(mapMessage).reverse()
  useChatStore.getState().setMessages(list, page.next ?? null)
  // the tail of the chat is no longer loaded — '#'/send-append semantics change
  useChatStore.setState({ detached: true })
  return list.findIndex((m) => m.id === msgId)
}

/** Fetch only messages newer than the cached tail — re-entry keeps the feed, this fills the gap */
export async function loadTail(peerId: string) {
  const { threadId } = useChatStore.getState()
  const last = useChatStore.getState().messages.at(-1)
  if (!last) return loadInitial(peerId)
  const page = threadId
    ? await tg.searchMessages({ chatId: Number(peerId), query: '', threadId, minId: last.id, limit: 50 })
    : await tg.getHistory(Number(peerId), { minId: last.id, limit: 50 })
  if (useChatStore.getState().peerId !== peerId) return
  // a whole page of missed messages means the middle is lost — rebuild instead
  if (page.length >= 50) return loadInitial(peerId)
  const { append } = useChatStore.getState()
  page
    .map(mapMessage)
    .reverse()
    .forEach((m) => append(m))
  useChatStore.setState({ detached: false })
  void markRead(peerId)
}

/** Prepend the next (older) history page; returns how many messages were added */
export async function loadOlder(peerId: string): Promise<number> {
  const { nextOffset, loadingMore, setLoadingMore, threadId } = useChatStore.getState()
  if (!nextOffset || loadingMore) return 0
  setLoadingMore(true)
  try {
    const page = threadId
      ? await tg.searchMessages({ chatId: Number(peerId), query: '', threadId, offset: nextOffset.id, limit: 30 })
      : await tg.getHistory(Number(peerId), { limit: 30, offset: nextOffset })
    if (useChatStore.getState().peerId !== peerId) return 0
    const mapped = page.map(mapMessage).reverse()
    useChatStore.getState().prepend(mapped)
    useChatStore.setState({ nextOffset: nextOffsetOf(page, threadId) })
    return mapped.length
  } finally {
    useChatStore.getState().setLoadingMore(false)
  }
}

export async function sendMessage(
  peerId: string,
  text: string,
  opts?: { replyTo?: { id: number; text: string } },
) {
  const tempId = -Date.now()
  const time = Math.floor(Date.now() / 1000)
  const { append, replace, remove } = useChatStore.getState()
  append({ id: tempId, out: true, text, time, mediaKind: 'none', replyTo: opts?.replyTo })
  try {
    const sent = await tg.sendText(Number(peerId), text, {
      replyTo: opts?.replyTo?.id,
      threadId: useChatStore.getState().threadId ?? undefined,
    })
    replace(tempId, mapMessage(sent))
    useDialogsStore.getState().bump(peerId, text, time, false, sent.id)
    // the server drops the draft once the message lands
    useDialogsStore.getState().setDraft(peerId, undefined)
  } catch (e) {
    // removing the bubble is the visible failure signal
    remove(tempId)
    logErr(e)
  }
}

export async function editMessageText(peerId: string, id: number, text: string) {
  const res = await tg.editMessage({ chatId: Number(peerId), message: id, text })
  useChatStore.getState().replace(id, mapMessage(res))
}

export async function deleteMessage(peerId: string, id: number) {
  await tg.deleteMessagesById(Number(peerId), [id])
  useChatStore.getState().remove(id)
}

export async function forwardMessage(toChatId: string, fromChatId: string, messageId: number) {
  await tg.forwardMessagesById({
    toChatId: Number(toChatId),
    fromChatId: Number(fromChatId),
    messages: [messageId],
  })
}

/** Persist the composer draft (server + row preview); null/'' clears it */
export async function saveDraftFor(peerId: string, text: string) {
  const value = text || undefined
  useDialogsStore.getState().setDraft(peerId, value)
  await tg.saveDraft(Number(peerId), value ? { message: value } : null).catch(logErr)
}

export async function markRead(peerId: string) {
  // readHistory isn't thread-scoped — a topic feed must not burn the whole group's unread
  if (useChatStore.getState().threadId != null) return
  useDialogsStore.getState().markRead(peerId)
  await tg.readHistory(Number(peerId)).catch(logErr)
}

export interface Topic {
  id: number
  title: string
  isPinned: boolean
  unreadCount: number
}

/** Forum topics of a supergroup («каналы» внутри группы) */
export async function getTopics(peerId: string): Promise<Topic[]> {
  const page = await tg.getForumTopics(Number(peerId), { limit: 100 })
  return page.map((t) => ({ id: t.id, title: t.title, isPinned: t.isPinned, unreadCount: t.unreadCount }))
}

let subscribed = false

/** Live updates: append to the open chat, bump the dialog list (once per session) */
export function initUpdates() {
  if (subscribed) return
  subscribed = true
  tg.onNewMessage.add((m) => {
    const id = String(m.chat.id)
    const isOpen = useChatStore.getState().peerId === id
    // a scoped topic feed only takes its own thread's messages
    const threadOk =
      useChatStore.getState().threadId == null ||
      m.replyToMessage?.threadId === useChatStore.getState().threadId
    // detached feeds (search/reply jump) have a gap — appending would corrupt order
    if (isOpen && !useChatStore.getState().detached && threadOk) {
      useChatStore.getState().append(mapMessage(m))
      if (!m.isOutgoing && useChatStore.getState().threadId == null)
        void tg.readHistory(m.chat.id, { maxId: m.id }).catch(logErr)
    }
    useDialogsStore
      .getState()
      .bump(
        id,
        messagePreview(m),
        tsOf(m),
        !m.isOutgoing && !isOpen,
        m.isOutgoing ? m.id : undefined,
      )
    // bump only touches existing rows — a peer beyond the first page still needs one
    // (dynamic import keeps dialogs.ts ↔ messages.ts acyclic at module load)
    if (!useDialogsStore.getState().dialogs.some((x) => x.id === id)) {
      void import('./dialogs.ts')
        .then((m2) => m2.loadDialog(id))
        .catch(logErr)
    }
    if (!m.isOutgoing && !isOpen) notifyIncoming(id)
  })
  tg.onEditMessage.add((m) => {
    const id = String(m.chat.id)
    if (useChatStore.getState().peerId === id) useChatStore.getState().replace(m.id, mapMessage(m))
    // only worth touching the row when the edited message is the dialog's latest
    const d = useDialogsStore.getState().dialogs.find((x) => x.id === id)
    if (d && tsOf(m) >= d.time) {
      useDialogsStore.getState().setPreview(id, messagePreview(m))
    }
  })
  tg.onDeleteMessage.add((u) => {
    const atPeer = useChatStore.getState().peerId
    // channelId is already marked (toggleChannelIdMark); null means a user/chat update
    const applies =
      atPeer != null &&
      (u.channelId == null ? Number(atPeer) > UNMARKED_PEER_MIN : atPeer === String(u.channelId))
    const dropIds = (ids: number[]) => {
      const tail = useChatStore.getState().messages.at(-1)
      ids.forEach((id) => useChatStore.getState().remove(id))
      // the deleted message was the feed tail — the dialog row would keep lying
      // (preview + ✓ outId) until the next event; sync it to the new tail now
      if (tail && ids.includes(tail.id)) {
        const m = useChatStore.getState().messages.at(-1)
        useDialogsStore
          .getState()
          .bump(atPeer!, m ? m.text || mediaLabel(m.mediaKind) : '', m?.time ?? 0, false, m?.out ? m.id : undefined)
      }
    }
    if (applies) {
      if (u.channelId != null) {
        dropIds(u.messageIds)
      } else {
        // non-channel deletes carry no peer — message ids are per-chat and overlap
        // everywhere, so remove only the ids that are actually gone in THIS peer
        void tg
          .getMessages(Number(atPeer), u.messageIds)
          .then((found) => {
            if (useChatStore.getState().peerId !== atPeer) return
            const got = new Set(found.filter((m) => m != null).map((m) => m.id))
            dropIds(u.messageIds.filter((id) => !got.has(id)))
          })
          .catch(logErr)
      }
    }
    // a closed dialog can only be pinned down by its outgoing last id —
    // refetch its real last message when that id was just deleted
    if (u.channelId != null) {
      const dialogId = String(u.channelId)
      const d = useDialogsStore.getState().dialogs.find((x) => x.id === dialogId)
      if (d?.outId != null && u.messageIds.includes(d.outId)) {
        void tg
          .getHistory(Number(dialogId), { limit: 1 })
          .then(([m]) =>
            useDialogsStore
              .getState()
              .bump(
                dialogId,
                messagePreview(m),
                m ? tsOf(m) : 0,
                false,
                m?.isOutgoing ? m.id : undefined,
              ),
          )
          .catch(logErr)
      }
    }
  })
  tg.onHistoryRead.add((u) => {
    if (u.isOutbox) useDialogsStore.getState().setReadOutbox(String(u.chatId), u.maxReadId)
    // the user read the chat on another device — sync our badge to the server's count.
    // discussion/monoforum updates carry a thread-scoped count, not the chat's badge
    else if (!u.isDiscussion && !u.isMonoForum)
      useDialogsStore.getState().setUnread(String(u.chatId), u.unreadCount)
  })
}
