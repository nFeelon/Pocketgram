import { describe, it, expect, vi } from 'vitest'

// auth.ts constructs a real MTProto client at import — stub it for unit tests
vi.mock('./client.ts', () => ({ tg: {} }))

import { isAuthFatal } from './auth.ts'

// isAuthFatal decides whether a failed RPC means "back to login" or "just log" —
// a false negative leaves the app spinning on a dead session, a false positive
// kicks the user to auth on an innocent error
describe('isAuthFatal', () => {
  it('treats revoked/deactivated errors as fatal', () => {
    expect(isAuthFatal({ code: 401 })).toBe(true)
    expect(isAuthFatal(new Error('AUTH_KEY_UNREGISTERED'))).toBe(true)
    expect(isAuthFatal(new Error('SESSION_REVOKED'))).toBe(true)
    expect(isAuthFatal(new Error('USER_DEACTIVATED_BAN'))).toBe(true)
  })

  it('treats ordinary RPC errors as non-fatal', () => {
    expect(isAuthFatal({ code: 400 })).toBe(false)
    expect(isAuthFatal(new Error('FLOOD_WAIT_30'))).toBe(false)
    expect(isAuthFatal(new Error('MESSAGE_ID_INVALID'))).toBe(false)
    expect(isAuthFatal('plain string')).toBe(false)
    expect(isAuthFatal(null)).toBe(false)
  })
})
