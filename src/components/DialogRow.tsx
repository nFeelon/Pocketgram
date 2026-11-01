import type { DialogEntry } from '../store/dialogs.ts'
import { useSettingsStore } from '../store/settings.ts'
import Avatar from './Avatar.tsx'
import PinIcon from '../assets/icons/pin.svg?react'
import { formatTime } from '../utils/format.ts'
import './DialogRow.css'

export default function DialogRow({ dialog }: { dialog: DialogEntry }) {
  const muted = useSettingsStore((s) => s.muted.includes(dialog.id))
  return (
    <div className={`dialog-row${dialog.unread > 0 ? ' has-unread' : ''}`} data-type={dialog.type}>
      <Avatar id={dialog.id} title={dialog.title} />
      <div className="dialog-main">
        <div className="dialog-top">
          <span className="dialog-title">{dialog.title}</span>
          {dialog.pinned && <PinIcon className="pin" />}
          {dialog.time > 0 && <span className="dialog-time">{formatTime(dialog.time)}</span>}
        </div>
        <div className="dialog-bottom">
          <span className={`dialog-preview${dialog.draft ? ' draft' : ''}`}>
            {dialog.draft ? `Черновик: ${dialog.draft}` : dialog.preview}
          </span>
          {dialog.unread > 0 && <span className={`unread${muted ? ' muted' : ''}`}>{dialog.unread}</span>}
        </div>
      </div>
    </div>
  )
}
