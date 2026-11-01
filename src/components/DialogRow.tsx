import type { DialogEntry } from '../store/dialogs.ts'
import Avatar from './Avatar.tsx'
import PinIcon from '../assets/icons/pin.svg?react'
import { formatTime } from '../utils/format.ts'
import './DialogRow.css'

export default function DialogRow({ dialog }: { dialog: DialogEntry }) {
  return (
    <div className="dialog-row" data-type={dialog.type}>
      <Avatar id={dialog.id} title={dialog.title} />
      <div className="dialog-main">
        <div className="dialog-top">
          <span className="dialog-title">{dialog.title}</span>
          {dialog.pinned && <PinIcon className="pin" />}
          <span className="dialog-time">{formatTime(dialog.time)}</span>
        </div>
        <div className="dialog-bottom">
          <span className="dialog-preview">{dialog.preview}</span>
          {dialog.unread > 0 && <span className="unread">{dialog.unread}</span>}
        </div>
      </div>
    </div>
  )
}
