import { useState, type FormEvent } from 'react'
import type { AdminUser, NewUser, UserPatch } from '../../core/admin/api'
import type { Profile } from '../../core/tablets/types'

const MIN_PASSWORD = 8

interface Props {
  /** null para crear una cuenta nueva. */
  user: AdminUser | null
  isSelf: boolean
  onSave: (data: NewUser | UserPatch) => Promise<void>
  onCancel: () => void
}

export function UserDialog({ user, isSelf, onSave, onCancel }: Props) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [role, setRole] = useState<Profile['role']>(user?.role ?? 'client')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const creating = !user
  const passwordError =
    (creating || password) && password.length < MIN_PASSWORD
      ? `Mínimo ${MIN_PASSWORD} caracteres.`
      : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (passwordError) return
    setBusy(true)
    setError(null)
    try {
      if (creating) {
        await onSave({ email, password, display_name: displayName.trim() || undefined, role })
      } else {
        // Solo se envía lo que cambió.
        const patch: UserPatch = { id: user.id }
        if (email.trim().toLowerCase() !== user.email) patch.email = email.trim()
        if (displayName.trim() !== (user.display_name ?? '')) patch.display_name = displayName.trim() || null
        if (role !== user.role) patch.role = role
        if (password) patch.password = password
        await onSave(patch)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{creating ? 'Nuevo usuario' : 'Editar usuario'}</h3>

        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={creating} />
        </label>

        <label>
          Nombre
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Opcional" />
        </label>

        <label>
          Rol
          <select value={role} onChange={(e) => setRole(e.target.value as Profile['role'])} disabled={isSelf}>
            <option value="client">Cliente</option>
            <option value="admin">Administrador</option>
          </select>
          {isSelf && <span className="muted small">No puedes cambiar tu propio rol.</span>}
        </label>

        <label>
          {creating ? 'Contraseña' : 'Nueva contraseña'}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={creating}
            autoComplete="new-password"
            placeholder={creating ? '' : 'Dejar vacío para no cambiarla'}
          />
          {passwordError && <span className="error small">{passwordError}</span>}
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions end">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={busy || Boolean(passwordError)}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
