import { useEffect, useRef } from 'react'
import { signIn, resendViaSms, loginViaQr, loginViaPhone } from '../tg/auth.ts'
import type { AuthField } from '../tg/auth.ts'
import { useAuthStore, authReady, authError } from '../store/auth.ts'
import './Auth.css'

const FIELD_META: Record<AuthField, { label: string; hint: string; type: 'tel' | 'text' | 'password' }> = {
  phone: { label: 'Номер телефона', hint: '+7 900 123-45-67', type: 'tel' },
  code: { label: 'Код из Telegram/SMS', hint: '12345', type: 'tel' },
  password: { label: 'Пароль 2FA', hint: 'Облачный пароль', type: 'password' },
}

export default function Auth() {
  const stage = useAuthStore((s) => s.stage)
  const error = useAuthStore((s) => s.error)
  const codeVia = useAuthStore((s) => s.codeVia)
  const qrImg = useAuthStore((s) => s.qrImg)
  const submit = useAuthStore((s) => s.submit)
  const ask = useAuthStore((s) => s._ask)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const smsRef = useRef<HTMLButtonElement>(null)
  const qrRef = useRef<HTMLButtonElement>(null)
  const qrImgRef = useRef<HTMLImageElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  const flowOk = (self: { displayName: string }) => {
    useAuthStore.setState({ selfName: self.displayName })
    authReady()
  }
  const flowErr = (e: unknown) =>
    authError(
      (e instanceof Error ? e.message : String(e)).replace(
        /FLOOD_WAIT_(\d+)/,
        'Слишком часто — подождите $1 с',
      ),
    )

  // Boot: restore session or run the interactive login flow exactly once
  useEffect(() => {
    signIn(ask).then(flowOk).catch(flowErr)
  }, [])

  useEffect(() => inputRef.current?.focus(), [stage])

  const meta = stage === 'phone' || stage === 'code' || stage === 'password' ? FIELD_META[stage] : null

  const submitField = () => {
    const v = inputRef.current?.value.trim()
    if (!v) return
    // phone/code fields: drop formatting junk before it reaches the API (password kept as typed)
    submit(stage === 'password' ? v : v.replace(/[^\d+]/g, ''))
    inputRef.current!.value = ''
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitField() // desktop/sim path — on device Enter opens the IME instead
    if (e.key === 'ArrowDown') nextRef.current?.focus()
  }

  return (
    <div id="app">
      <section className="auth-body">
        {meta && (
          <>
            <label className="auth-label">{meta.label}</label>
            <input
              ref={inputRef}
              type={meta.type}
              placeholder={meta.hint}
              onKeyDown={onKeyDown}
              autoFocus
            />
            <button
              ref={nextRef}
              className="auth-next"
              onClick={submitField}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') inputRef.current?.focus()
                if (e.key === 'ArrowDown') (smsRef.current ?? qrRef.current)?.focus()
              }}
            >
              Продолжить
            </button>
            {stage === 'code' && (
              <button
                ref={smsRef}
                className="auth-next secondary"
                onClick={() => void resendViaSms(ask).then(flowOk).catch(flowErr)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') nextRef.current?.focus()
                }}
              >
                Прислать SMS
              </button>
            )}
            {stage === 'phone' && (
              <button
                ref={qrRef}
                className="auth-next secondary"
                onClick={() => void loginViaQr(ask).then(flowOk).catch(flowErr)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') nextRef.current?.focus()
                }}
              >
                Вход по QR-коду
              </button>
            )}
            {stage === 'code' && codeVia && <p className="auth-hint">{codeVia}</p>}
          </>
        )}
        {stage === 'qr' && (
          <>
            {qrImg && (
              <img
                ref={qrImgRef}
                className="qr"
                src={qrImg}
                alt="QR для входа"
                width={96}
                height={96}
                tabIndex={0}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') backRef.current?.focus()
                }}
              />
            )}
            <button
              ref={backRef}
              className="auth-next secondary"
              onClick={() => void loginViaPhone(ask).then(flowOk).catch(flowErr)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') qrImgRef.current?.focus()
              }}
            >
              По номеру
            </button>
          </>
        )}
        {stage === 'boot' && <p className="auth-hint">Подключение…</p>}
        {error && <p className="auth-error">{error}</p>}
        {stage === 'error' && (
          <button autoFocus onClick={() => location.reload()}>
            Повторить
          </button>
        )}
      </section>
    </div>
  )
}
