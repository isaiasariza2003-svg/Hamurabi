import { useEffect, useState, type FormEvent } from 'react'
import {
  API_BASE_URL,
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKey,
} from '../../core/apikeys/api'
import { listTablets } from '../../core/tablets/repository'
import type { FieldDef, Tablet } from '../../core/tablets/types'
import { useAuth } from '../auth/AuthProvider'

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es') : '—')

/** Valor de ejemplo por tipo, para armar el cuerpo de la petición de muestra. */
function sampleValue(field: FieldDef): unknown {
  switch (field.type) {
    case 'number':
      return 1500
    case 'date':
      return '2026-10-29'
    case 'boolean':
      return true
    case 'select':
      return field.options?.[0] ?? ''
    default:
      return 'Juan Pérez'
  }
}

const sampleBody = (t: Tablet | undefined) =>
  JSON.stringify({ values: t ? Object.fromEntries(t.fields.map((f) => [f.key, sampleValue(f)])) : {} })

type Shell = 'bash' | 'cmd' | 'powershell'

const SHELLS: { id: Shell; label: string }[] = [
  { id: 'cmd', label: 'Windows (cmd)' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'bash', label: 'Linux / macOS' },
]

/** Ejemplo de generación de PDF con las comillas y continuaciones de línea de cada terminal. */
function renderExample(shell: Shell, url: string, body: string): string {
  switch (shell) {
    case 'cmd':
      return `curl -X POST "${url}" -H "Authorization: Bearer <tu-token>" -H "Content-Type: application/json" -d "${body.replace(/"/g, '\\"')}" -o documento.pdf`
    case 'powershell':
      // Invoke-RestMethod en lugar del alias curl; el cuerpo se envía como UTF-8 para conservar acentos.
      return `Invoke-RestMethod -Method Post -Uri "${url}" \`
  -Headers @{ Authorization = "Bearer <tu-token>" } \`
  -ContentType "application/json; charset=utf-8" \`
  -Body ([Text.Encoding]::UTF8.GetBytes('${body.replace(/'/g, "''")}')) \`
  -OutFile documento.pdf`
    default:
      return `curl -X POST "${url}" \\
  -H "Authorization: Bearer <tu-token>" \\
  -H "Content-Type: application/json" \\
  -d '${body.replace(/'/g, "'\\''")}' \\
  -o documento.pdf`
  }
}

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copia el texto:', text)
    }
  }
  return (
    <button type="button" className="ghost" onClick={() => void copy()}>
      {copied ? 'Copiado' : label}
    </button>
  )
}

export function ApiKeysPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [tablets, setTablets] = useState<Tablet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // Token recién creado: se muestra una sola vez.
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null)
  const [exampleId, setExampleId] = useState('')
  const [shell, setShell] = useState<Shell>('cmd')

  useEffect(() => {
    if (!userId) return
    Promise.all([listApiKeys(userId), listTablets(userId)])
      .then(([k, t]) => {
        setKeys(k)
        setTablets(t)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las API keys'))
      .finally(() => setLoading(false))
  }, [userId])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const { key, token } = await createApiKey(userId, name.trim())
      setKeys((prev) => [key, ...prev])
      setNewToken({ name: key.name, token })
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la key')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (k: ApiKey) => {
    if (!window.confirm(`¿Revocar "${k.name}"? Las aplicaciones que la usan dejarán de funcionar de inmediato.`)) return
    try {
      await revokeApiKey(k.id)
      setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, revoked_at: new Date().toISOString() } : x)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar')
    }
  }

  const remove = async (k: ApiKey) => {
    const warn = k.revoked_at ? '' : ' Está activa: las aplicaciones que la usan dejarán de funcionar.'
    if (!window.confirm(`¿Eliminar "${k.name}"?${warn}`)) return
    try {
      await deleteApiKey(k.id)
      setKeys((prev) => prev.filter((x) => x.id !== k.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  const example = tablets.find((t) => t.id === exampleId) ?? tablets[0]
  const exampleUrl = `${API_BASE_URL}/tablets/${example?.id ?? '<id-de-la-tablilla>'}/render`
  const curlPdf = renderExample(shell, exampleUrl, sampleBody(example))

  return (
    <main className="page wide">
      <div className="page-head">
        <h2>API</h2>
      </div>
      <p className="muted">
        Las API keys permiten que otras aplicaciones generen documentos con tus tablillas. Cada key solo accede a
        las tablillas de tu cuenta.
      </p>

      <form className="row card" onSubmit={create}>
        <input
          placeholder="Nombre de la key (p. ej. Sistema de facturación)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Creando…' : 'Crear API key'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Cargando…</p>}

      {!loading && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Token</th>
                <th>Estado</th>
                <th>Creada</th>
                <th>Último uso</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className={k.revoked_at ? 'dimmed' : undefined}>
                  <td>
                    <strong>{k.name}</strong>
                  </td>
                  <td>
                    <code>{k.prefix}…</code>
                  </td>
                  <td>
                    {k.revoked_at ? (
                      <span className="status off">Revocada</span>
                    ) : (
                      <span className="status ok">Activa</span>
                    )}
                  </td>
                  <td className="small">{formatDate(k.created_at)}</td>
                  <td className="small">{formatDate(k.last_used_at)}</td>
                  <td>
                    <div className="actions end-row">
                      {!k.revoked_at && <button onClick={() => void revoke(k)}>Revocar</button>}
                      <button className="danger" onClick={() => void remove(k)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Aún no tienes API keys.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <section className="card api-docs">
        <h3>Cómo usarla</h3>
        <p>
          URL base: <code>{API_BASE_URL}</code> <CopyButton text={API_BASE_URL} />
        </p>
        <p>
          Envía el token en cada petición con la cabecera <code>Authorization: Bearer &lt;tu-token&gt;</code>.
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Método y ruta</th>
              <th>Qué hace</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>GET /tablets</code>
              </td>
              <td>Lista tus tablillas con sus etiquetas (clave, tipo y opciones).</td>
            </tr>
            <tr>
              <td>
                <code>GET /tablets/:id</code>
              </td>
              <td>Detalle de una tablilla: hoja, márgenes y etiquetas.</td>
            </tr>
            <tr>
              <td>
                <code>POST /tablets/:id/render</code>
              </td>
              <td>
                Genera el documento. Cuerpo: <code>{'{ "values": { "clave": valor } }'}</code>. Devuelve el PDF; con{' '}
                <code>"output": "text"</code> devuelve JSON con el texto resuelto. Las etiquetas sin valor se listan en{' '}
                <code>missing</code> (o en la cabecera <code>X-Hamurabi-Missing</code> del PDF).
              </td>
            </tr>
          </tbody>
        </table>

        <p className="muted small">
          Valores: texto como cadena, números como número o cadena (<code>1500.5</code>), fechas como{' '}
          <code>AAAA-MM-DD</code>, sí/no como <code>true</code>/<code>false</code>, selección con una de sus opciones.
          Una etiqueta se envía una sola vez aunque aparezca con varios formatos en el texto. Límite: 60 peticiones por
          minuto por key. Errores: 401 token inválido o revocado, 404 tablilla inexistente o de otra cuenta, 429 límite
          superado.
        </p>

        <h3>Ejemplo</h3>
        <label>
          Terminal
          <select value={shell} onChange={(e) => setShell(e.target.value as Shell)}>
            {SHELLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {tablets.length > 0 && (
          <label>
            Tablilla
            <select value={example?.id} onChange={(e) => setExampleId(e.target.value)}>
              {tablets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {example && (
          <p className="small">
            ID: <code>{example.id}</code> <CopyButton text={example.id} label="Copiar ID" />
          </p>
        )}
        <pre className="code-sample">{curlPdf}</pre>
        <CopyButton text={curlPdf} label="Copiar ejemplo" />
      </section>

      {newToken && (
        <div className="modal-backdrop">
          <div className="card modal">
            <h3>API key creada: {newToken.name}</h3>
            <p>
              Copia el token ahora. <strong>No se volverá a mostrar</strong>: Hamurabi solo guarda una huella para
              verificarlo.
            </p>
            <pre className="code-sample token">{newToken.token}</pre>
            <div className="actions end">
              <CopyButton text={newToken.token} label="Copiar token" />
              <button onClick={() => setNewToken(null)}>Ya lo guardé</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
