import { useConnStore } from '../store/conn.ts'
import './Header.css'

export default function Header({ title, status }: { title: string; status?: string }) {
  const conn = useConnStore((s) => s.state)
  return (
    <>
      <title>{title}</title>
      <header className="app-header">
        {(conn === 'offline' || conn === 'connecting') && (
          <span className={`conn-dot ${conn}`} aria-hidden />
        )}
        <h1>{title}</h1>
        {status && <span className="status">{status}</span>}
      </header>
    </>
  )
}
