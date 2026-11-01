import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import { tg } from '../tg/client.ts'
import { statusText } from '../tg/peers.ts'
import './About.css'

interface Member {
  name: string
  status: string
}

/** Peer profile: getFullUser for users, getFullChat for groups/channels */
export default function Info() {
  const { peerId = '' } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('Информация')
  const [lines, setLines] = useState<string[]>([])
  const [canMembers, setCanMembers] = useState(false)
  const [members, setMembers] = useState<Member[] | null>(null)
  const bodyRef = useRef<HTMLElement>(null)
  const membersRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    const id = Number(peerId)
    const fill = (t: string, ls: string[]) => {
      if (!alive) return
      setTitle(t)
      setLines(ls.filter(Boolean))
    }
    if (id > 0) {
      void tg.getFullUser(id).then((u) => {
        fill(u.displayName, [
          u.username ? `@${u.username}` : '',
          u.phoneNumber ? `+${u.phoneNumber}` : '',
          statusText(u.status, u.lastOnline),
          u.bio,
        ])
      }).catch(console.error)
    } else {
      void tg.getFullChat(id).then((c) => {
        if (alive) setCanMembers(c.canViewParticipants)
        fill(c.title, [
          c.username ? `@${c.username}` : '',
          c.chatType === 'channel' ? 'канал' : 'группа',
          c.membersCount ? `участников: ${c.membersCount}` : '',
          c.onlineCount ? `в сети: ${c.onlineCount}` : '',
          c.bio,
        ])
      }).catch(console.error)
    }
    return () => {
      alive = false
    }
  }, [peerId])

  const loadMembers = () => {
    void tg
      .getChatMembers(Number(peerId), { limit: 50 })
      .then((list) =>
        setMembers(
          list.map((m) => ({
            name: m.user.displayName,
            status: statusText(m.user.status, m.user.lastOnline),
          })),
        ),
      )
      .catch(console.error)
  }

  // no list-focus — arrows scroll the body (or move to the members button)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        // before the list loads the only stop is the "Участники" button
        if (!members && canMembers && document.activeElement !== membersRef.current)
          membersRef.current?.focus()
        else bodyRef.current?.scrollBy({ top: 24 })
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (document.activeElement === membersRef.current) membersRef.current?.blur()
        else bodyRef.current?.scrollBy({ top: -24 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div id="app">
      <Header title={title} />
      <section className="about-body" ref={bodyRef}>
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        {canMembers && members === null && (
          <button ref={membersRef} className="members-btn" onClick={loadMembers}>
            Участники
          </button>
        )}
        {members?.map((m, i) => (
          <p key={i}>
            {m.name} · {m.status}
          </p>
        ))}
      </section>
      <SoftKeyBar
        buttons={{ end: { icon: 'back', title: 'Назад' } }}
        // 'start' = Escape too: on devices where RSK isn't a real popstate, LSK still exits
        onSoftKeyClick={(pos) => pos !== 'center' && navigate(-1)}
      />
    </div>
  )
}
