import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listUsers, type AdminUser } from '../../core/admin/api'
import { deleteTablet, listAllTablets } from '../../core/tablets/repository'
import type { Tablet } from '../../core/tablets/types'

type TabletRow = Omit<Tablet, 'content'>

/** Todas las tablillas de todos los usuarios, para revisarlas, editarlas o eliminarlas. */
export function AdminTabletsPage() {
  const [params, setParams] = useSearchParams()
  const owner = params.get('owner') ?? ''
  const [tablets, setTablets] = useState<TabletRow[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.all([listAllTablets(), listUsers()])
      .then(([t, u]) => {
        setTablets(t)
        setUsers(u)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las tablillas'))
      .finally(() => setLoading(false))
  }, [])

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tablets.filter((t) => (!owner || t.owner_id === owner) && (!q || t.name.toLowerCase().includes(q)))
  }, [tablets, owner, query])

  const setOwner = (id: string) => setParams(id ? { owner: id } : {})

  const remove = async (t: TabletRow) => {
    const who = usersById.get(t.owner_id)?.email ?? 'otro usuario'
    if (!window.confirm(`¿Eliminar la tablilla "${t.name}" de ${who}? Esta acción no se puede deshacer.`)) return
    try {
      await deleteTablet(t.id)
      setTablets((prev) => prev.filter((x) => x.id !== t.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  return (
    <main className="page wide">
      <div className="page-head">
        <h2>Tablillas de todos los usuarios</h2>
      </div>

      <div className="row filters">
        <input placeholder="Buscar por nombre" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filtrar por usuario">
          <option value="">Todos los usuarios</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name ? `${u.display_name} (${u.email})` : u.email}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando…</p>}

      {!loading && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Tablilla</th>
                <th>Dueño</th>
                <th>Hoja</th>
                <th>Etiquetas</th>
                <th>Actualizada</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const u = usersById.get(t.owner_id)
                return (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                    </td>
                    <td>
                      <button className="link" onClick={() => setOwner(t.owner_id)} title="Ver solo sus tablillas">
                        {u?.display_name || u?.email || t.owner_id}
                      </button>
                      {u?.status === 'suspended' && <span className="status off">Suspendido</span>}
                    </td>
                    <td>{t.page_size === 'letter' ? 'Carta' : 'Oficio'}</td>
                    <td>{t.fields.length}</td>
                    <td className="small">{new Date(t.updated_at).toLocaleString('es')}</td>
                    <td>
                      <div className="actions end-row">
                        <Link className="button-link ghost" to={`/tablets/${t.id}/generate`}>
                          Generar
                        </Link>
                        <Link className="button-link" to={`/tablets/${t.id}`}>
                          Editar
                        </Link>
                        <button className="danger" onClick={() => void remove(t)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin tablillas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
