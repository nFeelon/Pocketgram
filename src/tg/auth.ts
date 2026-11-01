import { tg } from './client.ts'
import { useAuthStore } from '../store/auth.ts'

export type AuthField = 'phone' | 'code' | 'password'

// React StrictMode double-mounts effects in dev — memoize so tg.start never runs twice
let flow: ReturnType<typeof tg.start> | undefined

/**
 * Drives tg.start() where each credential request is delegated to the UI:
 * `ask` must return a promise resolved when the user submits the field.
 */
export function signIn(ask: (field: AuthField) => Promise<string>) {
  flow ??= tg
    .start({
      phone: () => ask('phone'),
      code: () => ask('code'),
      password: () => ask('password'),
      invalidCodeCallback: (type) =>
        useAuthStore.setState({
          error: type === 'code' ? 'Неверный код, попробуйте ещё раз' : 'Неверный пароль',
        }),
    })
    .catch((e) => {
      flow = undefined
      throw e
    })
  return flow
}

/** Terminate the Telegram session, drop the local session store and restart */
export async function signOut() {
  try {
    await tg.call({ _: 'auth.logOut' })
  } finally {
    flow = undefined
    // wait for deletion before reload — otherwise reload wins the race and the session survives
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('pocketgram')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
    location.reload()
  }
}
