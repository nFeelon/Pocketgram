import { describe, it, expect, vi } from 'vitest'

// media.ts constructs a real MTProto client at import — stub it for unit tests
vi.mock('./client.ts', () => ({ tg: {} }))

import { mediaKind } from './media.ts'
import { formatDuration, formatSize } from '../utils/format.ts'

// mediaKind drives every media render path — a wrong bucket means a video is
// offered to the audio player, or a playable file renders as dead text
describe('mediaKind', () => {
  it('maps telegram media types', () => {
    expect(mediaKind({ type: 'photo' })).toBe('photo')
    expect(mediaKind({ type: 'video' })).toBe('video')
    expect(mediaKind({ type: 'video', isRound: true })).toBe('video_note')
    expect(mediaKind({ type: 'voice' })).toBe('voice')
    expect(mediaKind({ type: 'audio' })).toBe('audio')
    expect(mediaKind({ type: 'sticker' })).toBe('sticker')
    expect(mediaKind({ type: 'document' })).toBe('file')
  })

  it('falls back to none for missing/unknown media', () => {
    expect(mediaKind(null)).toBe('none')
    expect(mediaKind(undefined)).toBe('none')
    expect(mediaKind({})).toBe('none')
    expect(mediaKind({ type: 'poll' })).toBe('none')
  })
})

describe('formatSize', () => {
  it('formats byte counts', () => {
    expect(formatSize(512)).toBe('512 Б')
    expect(formatSize(2048)).toBe('2 КБ')
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 МБ')
  })
})

describe('formatDuration', () => {
  it('formats m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(83)).toBe('1:23')
    expect(formatDuration(600)).toBe('10:00')
  })
})
