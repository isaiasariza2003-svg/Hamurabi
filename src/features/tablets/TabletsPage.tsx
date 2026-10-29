import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTablet, deleteTablet, listTablets } from '../../core/tablets/repository'
import type { Tablet } from '../../core/tablets/types'
import { useAuth } from '../auth/AuthProvider'

export function TabletsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [tablets, setTablets] = useState<Tablet[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    listTablets(userId)
      .then(setTablets)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las tablillas'))
      .finally(() => setLoading(false))
  }, [userId])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!session || !name.trim()) return
    try {
      const t = await createTablet(session.user.id, name.trim())
      navigate(`/tablets/${t.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tablilla')
    }
  }

  const remove = async (t: Tablet) => {
    if (!window.confirm(`¿Eliminar la tablilla "${t.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteTablet(t.id)
      setTablets((prev) => prev.filter((x) => x.id !== t.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  return (
    <main className="page">
      <h2>Mis tablillas</h2>

      <form className="row" onSubmit={create}>
        <input
          placeholder="Nombre de la nueva tablilla"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        <button type="submit" disabled={!name.trim()}>
          Crear
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando…</p>}
      {!loading && tablets.length === 0 && <p className="muted">Aún no tienes tablillas.</p>}

      <ul className="list">
        {tablets.map((t) => (
          <li key={t.id} className="card list-item">
            <div>
              <strong>{t.name}</strong>
              <div className="muted small">
                {t.page_size === 'letter' ? 'Carta' : 'Oficio'} · {t.fields.length} campos ·{' '}
                {new Date(t.updated_at).toLocaleString('es')}
              </div>
            </div>
            <div className="actions">
              <button className="ghost" onClick={() => navigate(`/tablets/${t.id}/generate`)}>
                Generar
              </button>
              <button onClick={() => navigate(`/tablets/${t.id}`)}>Editar</button>
              <button className="danger" onClick={() => void remove(t)}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
