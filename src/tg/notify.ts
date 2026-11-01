import { useSettingsStore } from '../store/settings.ts'
import { hasFeature } from '../utils/features.ts'

/** No WebAudio on Cloud Phone — a tiny WAV built in code: 440 Hz, 120 ms, 16-bit mono PCM */
function makeBeepUrl(): string {
  const rate = 8000
  const n = Math.floor(rate * 0.12)
  const data = new DataView(new ArrayBuffer(44 + n * 2))
  const wstr = (off: number, s: string) => [...s].forEach((c, i) => data.setUint8(off + i, c.charCodeAt(0)))
  wstr(0, 'RIFF')
  data.setUint32(4, 36 + n * 2, true)
  wstr(8, 'WAVEfmt ')
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true) // PCM
  data.setUint16(22, 1, true) // mono
  data.setUint32(24, rate, true)
  data.setUint32(28, rate * 2, true)
  data.setUint16(32, 2, true)
  data.setUint16(34, 16, true)
  wstr(36, 'data')
  data.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    // fade out the last 15 ms to avoid a speaker click
    const fade = i > n - 120 ? (n - i) / 120 : 1
    data.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 440 * i) / rate) * 0.35 * fade * 32767, true)
  }
  console.assert(data.getUint32(4, true) === data.byteLength - 8, 'bad RIFF size')
  return URL.createObjectURL(new Blob([data.buffer], { type: 'audio/wav' }))
}

let audio: HTMLAudioElement | null = null
const ensureAudio = () => (audio ??= new Audio(makeBeepUrl()))
let canVibrate = false
void hasFeature('Vibrate').then((v) => (canVibrate = v))

// autoplay may be gesture-gated — a muted play inside the first real keypress unlocks it
window.addEventListener(
  'keydown',
  () => {
    const a = ensureAudio()
    a.muted = true
    void a
      .play()
      .then(() => {
        a.pause()
        a.currentTime = 0
        a.muted = false
      })
      .catch(() => {
        a.muted = false
      })
  },
  { once: true },
)

/** Incoming-message signal honoring sound/vibrate/dnd/muted from settings */
export function notifyIncoming(peerId: string) {
  const { sound, vibrate, dnd, muted } = useSettingsStore.getState()
  if (dnd || muted.includes(peerId)) return
  if (sound) {
    const a = ensureAudio()
    a.currentTime = 0
    void a.play().catch(() => {})
  }
  if (vibrate && canVibrate) navigator.vibrate(100)
}
