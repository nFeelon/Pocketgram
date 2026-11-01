import type { DialogEntry } from '../store/dialogs.ts'
import { useSettingsStore } from '../store/settings.ts'
import Avatar from './Avatar.tsx'
import Marquee from './Marquee.tsx'
import PinIcon from '../assets/icons/pin.svg?react'
import { formatListTime } from '../utils/format.ts'
import './DialogRow.css'

export default function DialogRow({ dialog }: { dialog: DialogEntry }) {
  const muted = useSettingsStore((s) => s.muted.includes(dialog.id))
  return (
    <div className={`dialog-row${dialog.unread > 0 ? ' has-unread' : ''}`} data-type={dialog.type}>
      <Avatar id={dialog.id} title={dialog.title} photo={dialog.photo} />
      <div className="dialog-main">
        <div className="dialog-top">
          <span className="dialog-title">
            <Marquee text={dialog.title} />
          </span>
          {dialog.pinned && <PinIcon className="pin" />}
          {dialog.time > 0 && <span className="dialog-time">{formatListTime(dialog.time)}</span>}
        </div>
        <div className="dialog-bottom">
          <span className={`dialog-preview${dialog.draft ? ' draft' : ''}`}>
            {!dialog.draft && dialog.outId != null && (
              <span className="read-tick">{dialog.outId <= dialog.readOutbox ? '✓✓' : '✓'}</span>
            )}
            <Marquee
              whenFocused
              text={dialog.draft ? `Черновик: ${dialog.draft}` : dialog.preview}
            />
          </span>
          {dialog.unread > 0 && <span className={`unread${muted ? ' muted' : ''}`}>{dialog.unread}</span>}
        </div>
      </div>
    </div>
  )
}
