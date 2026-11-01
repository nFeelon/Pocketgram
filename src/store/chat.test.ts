import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chat.ts'
import type { ChatMessage } from './chat.ts'

const msg = (id: number, text = ''): ChatMessage => ({
  id,
  out: false,
  text,
  time: 0,
  mediaKind: 'none',
})

beforeEach(() => {
  useChatStore.getState().setMessages([], null)
})

// message ids are the feed's identity — a duplicated row renders the same
// bubble twice and breaks focus/keyed reconciliation
describe('chat store dedup', () => {
  it('append ignores an id that is already in the feed', () => {
    const { append } = useChatStore.getState()
    append(msg(1, 'a'))
    append(msg(1, 'a-again'))
    append(msg(2, 'b'))
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual([1, 2])
    expect(useChatStore.getState().messages[0].text).toBe('a')
  })

  it('prepend drops page overlaps instead of duplicating the seam', () => {
    useChatStore.getState().setMessages([msg(4), msg(5), msg(6)], null)
    useChatStore.getState().prepend([msg(1), msg(2), msg(4), msg(5)])
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual([1, 2, 4, 5, 6])
  })
})

// sendText inserts a temp message (negative id), then swaps in the real one —
// but the onNewMessage update may have appended the real id first
describe('chat store replace', () => {
  it('renames the temp row when the real id is not present', () => {
    useChatStore.getState().setMessages([msg(1), msg(-1, 'temp')], null)
    useChatStore.getState().replace(-1, msg(7, 'sent'))
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual([1, 7])
    expect(useChatStore.getState().messages[1].text).toBe('sent')
  })

  it('drops the temp row when the update already appended the real message', () => {
    useChatStore.getState().setMessages([msg(-1, 'temp'), msg(7, 'from update')], null)
    useChatStore.getState().replace(-1, msg(7, 'sent'))
    const ms = useChatStore.getState().messages
    expect(ms.map((m) => m.id)).toEqual([7])
    expect(ms[0].text).toBe('from update')
  })

  it('edits in place when the id is unchanged', () => {
    useChatStore.getState().setMessages([msg(1, 'old'), msg(2)], null)
    useChatStore.getState().replace(1, msg(1, 'edited'))
    expect(useChatStore.getState().messages.map((m) => [m.id, m.text])).toEqual([
      [1, 'edited'],
      [2, ''],
    ])
  })
})
