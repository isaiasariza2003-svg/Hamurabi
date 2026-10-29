import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

/** Protege las rutas privadas: sin sesión activa redirige a /login. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <p className="center">Cargando…</p>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Solo administradores. La seguridad real está en RLS y la Edge Function; esto evita pantallas inútiles. */
export function RequireAdmin() {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') return <Navigate to="/tablets" replace />
  return <Outlet />
}

export function AppShell() {
  const { profile, session, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  return (
    <>
      <header className="topbar">
        <Link to="/tablets" className="brand">
          Hamurabi
        </Link>
        <nav className="main-nav">
          <NavLink to="/tablets" end>
            Mis tablillas
          </NavLink>
          <NavLink to="/api-keys">API</NavLink>
          {isAdmin && (
            <>
              <NavLink to="/admin/users">Usuarios</NavLink>
              <NavLink to="/admin/tablets">Todas las tablillas</NavLink>
            </>
          )}
        </nav>
        <div className="user-box">
          <span className="muted small">{profile?.display_name || session?.user.email}</span>
          <button className="ghost" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </header>
      <Outlet />
    </>
  )
}
