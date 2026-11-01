import { tg } from './client.ts'

export type AuthField = 'phone' | 'code' | 'password'

/**
 * Drives tg.start() where each credential request is delegated to the UI:
 * `ask` must return a promise resolved when the user submits the field.
 */
export async function signIn(ask: (field: AuthField) => Promise<string>) {
  const self = await tg.start({
    phone: () => ask('phone'),
    code: () => ask('code'),
    password: () => ask('password'),
  })
  return self
}

export async function signOut() {
  // TODO: terminate the Telegram session (auth.logOut) and drop local storage
}
