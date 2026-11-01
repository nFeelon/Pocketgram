import { useEffect, useRef, useState } from 'react'
import { signIn } from '../tg/auth.ts'
import type { AuthField } from '../tg/auth.ts'
import { useAuthStore, authReady, authError } from '../store/auth.ts'
import Header from '../components/Header.tsx'
import './Auth.css'

const FIELD_META: Record<AuthField, { label: string; hint: string; type: 'tel' | 'text' | 'password' }> = {
  phone: { label: 'Номер телефона', hint: '+7 900 123-45-67', type: 'tel' },
  code: { label: 'Код из Telegram/SMS', hint: '12345', type: 'tel' },
  password: { label: 'Пароль 2FA', hint: 'Облачный пароль', type: 'password' },
}

export default function Auth() {
  const stage = useAuthStore((s) => s.stage)
  const error = useAuthStore((s) => s.error)
  const submit = useAuthStore((s) => s.submit)
  const ask = useAuthStore((s) => s._ask)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  // Boot: restore session or run the interactive login flow exactly once
  useEffect(() => {
    setBusy(true)
    signIn(ask)
      .then((self) => {
        useAuthStore.setState({ selfName: self.displayName })
        authReady()
      })
      .catch((e: unknown) => authError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => inputRef.current?.focus(), [stage])

  const meta = stage === 'phone' || stage === 'code' || stage === 'password' ? FIELD_META[stage] : null

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputRef.current) {
      const v = inputRef.current.value.trim()
      if (v) {
        inputRef.current.value = ''
        submit(v)
      }
    }
  }

  return (
    <div id="app">
      <Header title="Pocketgram" />
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
            <p className="auth-hint">Enter — продолжить</p>
          </>
        )}
        {stage === 'boot' || busy ? <p className="auth-hint">Подключение…</p> : null}
        {stage === 'error' && <p className="auth-error">{error}</p>}
      </section>
    </div>
  )
}
