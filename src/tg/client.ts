import { TelegramClient } from '@mtcute/web'
import { useConnStore } from '../store/conn.ts'

const apiId = Number(import.meta.env.VITE_TG_API_ID)
const apiHash = import.meta.env.VITE_TG_API_HASH

if (!apiId || !apiHash) {
  // Shows up as a blank screen anyway on device — log for the debugger
  console.error('VITE_TG_API_ID / VITE_TG_API_HASH are not set — see .env.example')
}

export const tg = new TelegramClient({
  apiId,
  apiHash,
  // IndexedDB-backed storage; encrypted by Cloud Phone with a device-side key
  storage: 'pocketgram',
})

tg.onConnectionState.add((state) => useConnStore.setState({ state }))
