/** "12:41" */
export function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** 'Сегодня' / 'Вчера' / 'DD.MM.YYYY' — date separators in the feed */
export function formatDay(ts: number): string {
  const d = new Date(ts * 1000)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Сегодня'
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

/** dialog list stamp: today → "12:41", anything older → "05.03" */
export function formatListTime(ts: number): string {
  const d = new Date(ts * 1000)
  if (d.toDateString() === new Date().toDateString()) return formatTime(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

/** "1:23" for voice/video durations */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "1.2 MB" — used in the pre-play size hint */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

/** First letter for the avatar circle */
export function initial(title: string): string {
  return (title.trim()[0] ?? '?').toUpperCase()
}
