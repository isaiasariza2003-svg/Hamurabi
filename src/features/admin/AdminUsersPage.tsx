import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type AdminUser,
  type NewUser,
  type UserPatch,
} from '../../core/admin/api'
import { useAuth } from '../auth/AuthProvider'
import { UserDialog } from './UserDialog'

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es') : '—')

export function AdminUsersPage() {
  const { session } = useAuth()
  const selfId = session?.user.id
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // undefined: cerrado; null: crear; AdminUser: editar.
  const [editing, setEditing] = useState<AdminUser | null | undefined>(undefined)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.email.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q))
  }, [users, query])

  /** Ejecuta una acción sobre un usuario y recarga la lista. */
  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La operación falló')
    } finally {
      setBusyId(null)
    }
  }

  const onSave = async (data: NewUser | UserPatch) => {
    if ('id' in data) await updateUser(data)
    else await createUser(data)
    setEditing(undefined)
    await refresh()
  }

  const toggleStatus = (u: AdminUser) => {
    const suspend = u.status === 'active'
    const msg = suspend
      ? `¿Suspender a ${u.email}? No podrá entrar ni usar sus API keys hasta que lo reactives.`
      : `¿Reactivar a ${u.email}?`
    if (window.confirm(msg)) void run(u.id, () => updateUser({ id: u.id, status: suspend ? 'suspended' : 'active' }))
  }

  const remove = (u: AdminUser) => {
    const extra = u.tablet_count ? ` Se eliminarán también sus ${u.tablet_count} tablilla(s) y sus API keys.` : ''
    if (window.confirm(`¿Eliminar la cuenta ${u.email}?${extra} Esta acción no se puede deshacer.`)) {
      void run(u.id, () => deleteUser(u.id))
    }
  }

  // Cuenta de Auth sin perfil (creada fuera de Hamurabi): darle acceso como cliente.
  const enable = (u: AdminUser) => void run(u.id, () => updateUser({ id: u.id, role: 'client', status: 'active' }))

  return (
    <main className="page wide">
      <div className="page-head">
        <h2>Usuarios</h2>
        <button onClick={() => setEditing(null)}>+ Nuevo usuario</button>
      </div>

      <input
        className="search"
        placeholder="Buscar por correo o nombre"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando…</p>}

      {!loading && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Tablillas</th>
                <th>Último acceso</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const isSelf = u.id === selfId
                const busy = busyId === u.id
                return (
                  <tr key={u.id} className={u.status === 'suspended' ? 'dimmed' : ''}>
                    <td>
                      <strong>{u.display_name || u.email}</strong>
                      {u.display_name && <div className="muted small">{u.email}</div>}
                      {isSelf && <span className="badge">Tú</span>}
                    </td>
                    <td>{u.role === 'admin' ? 'Administrador' : u.role === 'client' ? 'Cliente' : '—'}</td>
                    <td>
                      {u.status === 'active' && <span className="status ok">Activo</span>}
                      {u.status === 'suspended' && <span className="status off">Suspendido</span>}
                      {u.status === null && <span className="status warn">Sin perfil</span>}
                    </td>
                    <td>
                      <Link to={`/admin/tablets?owner=${u.id}`}>{u.tablet_count}</Link>
                    </td>
                    <td className="small">{formatDate(u.last_sign_in_at)}</td>
                    <td>
                      <div className="actions end-row">
                        {u.status === null ? (
                          <button onClick={() => enable(u)} disabled={busy}>
                            Dar acceso
                          </button>
                        ) : (
                          <>
                            <button className="ghost" onClick={() => setEditing(u)} disabled={busy}>
                              Editar
                            </button>
                            {!isSelf && (
                              <button className="ghost" onClick={() => toggleStatus(u)} disabled={busy}>
                                {u.status === 'active' ? 'Suspender' : 'Reactivar'}
                              </button>
                            )}
                          </>
                        )}
                        {!isSelf && (
                          <button className="danger" onClick={() => remove(u)} disabled={busy}>
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing !== undefined && (
        <UserDialog
          user={editing}
          isSelf={editing?.id === selfId}
          onSave={onSave}
          onCancel={() => setEditing(undefined)}
        />
      )}
    </main>
  )
}
