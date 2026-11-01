import './Header.css'

export default function Header({ title, status }: { title: string; status?: string }) {
  return (
    <>
      <title>{title}</title>
      <header className="app-header">
        <h1>{title}</h1>
        {status && <span className="status">{status}</span>}
      </header>
    </>
  )
}
