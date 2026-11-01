import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import Header from '../components/Header.tsx'
import SoftKeyBar from '../components/SoftKeyBar.tsx'
import Avatar from '../components/Avatar.tsx'
import { tg } from '../tg/client.ts'
import { statusText } from '../tg/peers.ts'
import { useCleanHash } from '../utils/history.ts'
import './About.css'

interface Member {
  id: string
  name: string
  status: string
  photo?: Parameters<typeof Avatar>[0]['photo']
}

interface Profile {
  title: string
  photo?: Parameters<typeof Avatar>[0]['photo']
  /** secondary lines under the name — @username, phone, "канал"/"группа" */
  subs: string[]
  /** last-seen line */
  status?: string
  /** fact chips — участников / подписчиков / в сети */
  stats: string[]
  bio?: string
}

/** Peer profile: getFullUser for users, getFullChat for groups/channels */
export default function Info() {
  const { peerId = '' } = useParams()
  const navigate = useNavigate()
  useCleanHash()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [canMembers, setCanMembers] = useState(false)
  const [members, setMembers] = useState<Member[] | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)
  const bodyRef = useRef<HTMLElement>(null)
  const membersRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    const id = Number(peerId)
    const done = (p: Profile) => {
      if (alive) setProfile(p)
    }
    const fail = (e: unknown) => {
      console.error(e)
      if (alive) setLoadErr(true)
    }
    if (id > 0) {
      void tg.getFullUser(id).then((u) =>
        done({
          title: u.displayName,
          photo: u.photo?.small,
          subs: [u.username ? `@${u.username}` : '', u.phoneNumber ? `+${u.phoneNumber}` : ''].filter(
            Boolean,
          ),
          status: statusText(u.status, u.lastOnline),
          stats: [],
          bio: u.bio,
        }),
      ).catch(fail)
    } else {
      void tg.getFullChat(id).then((c) => {
        if (alive) setCanMembers(c.canViewParticipants)
        done({
          title: c.title,
          photo: c.photo?.small,
          subs: [c.username ? `@${c.username}` : '', c.chatType === 'channel' ? 'канал' : 'группа'].filter(
            Boolean,
          ),
          stats: [
            c.membersCount
              ? `${c.chatType === 'channel' ? 'подписчиков' : 'участников'}: ${c.membersCount}`
              : '',
            c.onlineCount ? `в сети: ${c.onlineCount}` : '',
          ].filter(Boolean),
          bio: c.bio,
        })
      }).catch(fail)
    }
    return () => {
      alive = false
    }
  }, [peerId])

  const loadMembers = () => {
    setMembersLoading(true)
    void tg
      .getChatMembers(Number(peerId), { limit: 50 })
      .then((list) =>
        setMembers(
          list.map((m) => ({
            id: String(m.user.id),
            name: m.user.displayName,
            status: statusText(m.user.status, m.user.lastOnline),
            photo: m.user.photo?.small,
          })),
        ),
      )
      .catch(console.error)
      .finally(() => setMembersLoading(false))
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
      <Header title={profile?.title ?? 'Информация'} />
      <section className="about-body" ref={bodyRef}>
        {!profile && !loadErr && (
          <div className="center-loader">
            <span className="spin" />
            <p>Загрузка…</p>
          </div>
        )}
        {loadErr && <p>Ошибка загрузки</p>}
        {profile && (
          <>
            <div className="info-head">
              <Avatar id={peerId} title={profile.title} photo={profile.photo} />
              <div className="info-main">
                <p className="info-name">{profile.title}</p>
                {profile.subs.map((s) => (
                  <p key={s} className="info-sub">
                    {s}
                  </p>
                ))}
                {profile.status && <p className="info-sub">{profile.status}</p>}
              </div>
            </div>
            {profile.stats.length > 0 && <p className="info-stats">{profile.stats.join(' · ')}</p>}
            {profile.bio && <p className="info-bio">{profile.bio}</p>}
          </>
        )}
        {canMembers && members === null && (
          <button ref={membersRef} className="members-btn" onClick={loadMembers}>
            {membersLoading ? 'Загрузка…' : 'Участники'}
          </button>
        )}
        {members?.map((m) => (
          <div key={m.id} className="member">
            <Avatar id={m.id} title={m.name} photo={m.photo} />
            <div className="member-main">
              <p className="member-name">{m.name}</p>
              <p className="member-sub">{m.status}</p>
            </div>
          </div>
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
