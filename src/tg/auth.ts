import { tg } from './client.ts'
import { useAuthStore, clearAuthAsk } from '../store/auth.ts'

export type AuthField = 'phone' | 'code' | 'password'

// React StrictMode double-mounts effects in dev — memoize so tg.start never runs twice
let flow: ReturnType<typeof tg.start> | undefined
// an abandoned flow (SMS retry / QR toggle) keeps running — generation-guard its
// callbacks so they can't hijack the stage or overwrite delivery hints
let flowGen = 0
// phone cached after the first ask — an SMS-retry restarts the flow without re-asking
let lastPhone: string | undefined

// where Telegram actually sent the code — surfaced in the UI (device has no console)
const VIA: Record<string, string> = {
  app: 'в Telegram (сервисный чат)',
  sms: 'по SMS',
  sms_word: 'по SMS',
  sms_phrase: 'по SMS',
  call: 'звонком',
  flash_call: 'звонком — код = последние цифры номера',
  missed_call: 'звонком — код = последние цифры номера',
  email: 'на e-mail',
}

/**
 * Drives tg.start() where each credential request is delegated to the UI:
 * `ask` must return a promise resolved when the user submits the field.
 */
export function signIn(
  ask: (field: AuthField) => Promise<string>,
  opts: { forceSms?: boolean; qr?: boolean } = {},
) {
  if (flow) return flow
  const gen = ++flowGen
  flow = tg
    .start({
      phone: () => lastPhone ?? ask('phone').then((v) => (lastPhone = v)),
      forceSms: opts.forceSms ?? false,
      code: () => ask('code'),
      password: () => ask('password'),
      // QR flow replaces phone+code entirely — the handler is re-called each time
      // the login token rotates, so keep the rendered image fresh.
      // qrcode is a separate chunk: it only loads when the user actually picks QR login
      qrCodeHandler: opts.qr
        ? (url) =>
            void import('qrcode').then((QRCode) =>
              QRCode.toDataURL(url, { margin: 0, width: 96 }).then((qrImg) => {
                if (gen === flowGen) useAuthStore.setState({ stage: 'qr', qrImg })
              }),
            )
        : undefined,
      // fires after Telegram accepted the number — the request definitely went out
      codeSentCallback: (sent) => {
        if (gen === flowGen)
          useAuthStore.setState({ codeVia: `Код отправлен: ${VIA[sent.type] ?? sent.type}` })
      },
      invalidCodeCallback: (type) => {
        if (gen === flowGen)
          useAuthStore.setState({
            error: type === 'code' ? 'Неверный код, попробуйте ещё раз' : 'Неверный пароль',
          })
      },
    })
    .catch((e) => {
      flow = undefined
      throw e
    })
  return flow
}

/**
 * Abandon the current start() and re-run it with forceSms — Telegram re-delivers
 * the code via the next channel (usually SMS) with a fresh phoneCodeHash.
 * A plain tg.resendCode() would mint a new hash that the running start() never sees.
 */
export function resendViaSms(ask: (field: AuthField) => Promise<string>) {
  flow = undefined
  clearAuthAsk()
  return signIn(ask, { forceSms: true })
}

/** Restart the flow over QR login — bypasses code delivery entirely */
export function loginViaQr(ask: (field: AuthField) => Promise<string>) {
  flow = undefined
  clearAuthAsk()
  return signIn(ask, { qr: true })
}

/** Back to the phone-number flow — clears the cached phone so it can be re-entered */
export function loginViaPhone(ask: (field: AuthField) => Promise<string>) {
  flow = undefined
  lastPhone = undefined
  clearAuthAsk()
  useAuthStore.setState({ stage: 'boot', qrImg: null })
  return signIn(ask)
}

/** Terminate the Telegram session, drop the local session store and restart */
export async function signOut() {
  try {
    await tg.call({ _: 'auth.logOut' })
  } finally {
    flow = undefined
    lastPhone = undefined
    // wait for deletion before reload — otherwise reload wins the race and the session survives
    await new Promise<void>((resolve) => {
      let done = 0
      const fin = () => ++done === 2 && resolve()
      // media blobs of the previous account must not greet the next sign-in
      for (const name of ['pocketgram', 'pg-media-cache']) {
        const req = indexedDB.deleteDatabase(name)
        req.onsuccess = req.onerror = req.onblocked = fin
      }
    })
    location.reload()
  }
}
