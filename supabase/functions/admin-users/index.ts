// Gestión de cuentas para administradores. Usa la clave de servicio, que nunca llega al navegador.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Suspender = perfil 'suspended' (RLS) + baneo en Auth (no puede renovar sesión). ~100 años.
const BAN_FOREVER = '876000h'
const ROLES = ['admin', 'client'] as const
const STATUSES = ['active', 'suspended'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function str(v: unknown, field: string, { optional = false } = {}): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined
    throw new HttpError(400, `Falta el campo ${field}`)
  }
  if (typeof v !== 'string') throw new HttpError(400, `El campo ${field} debe ser texto`)
  return v.trim()
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T | undefined {
  if (v === undefined) return undefined
  if (!allowed.includes(v as T)) throw new HttpError(400, `Valor inválido para ${field}`)
  return v as T
}

function checkEmail(email: string) {
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Correo inválido')
}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
  }
}

/** Devuelve el id del llamante si es un administrador activo. */
async function requireAdmin(req: Request, admin: SupabaseClient): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'No autenticado')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sesión inválida')
  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profile?.role !== 'admin' || profile.status !== 'active') {
    throw new HttpError(403, 'Solo un administrador puede hacer esto')
  }
  return data.user.id
}

async function listUsers(admin: SupabaseClient) {
  const users: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) break
  }
  const [{ data: profiles, error: pErr }, { data: tablets, error: tErr }] = await Promise.all([
    admin.from('profiles').select('id, role, status, display_name'),
    admin.from('tablets').select('owner_id'),
  ])
  if (pErr) throw pErr
  if (tErr) throw tErr

  const byId = new Map(profiles!.map((p) => [p.id, p]))
  const counts = new Map<string, number>()
  for (const t of tablets!) counts.set(t.owner_id, (counts.get(t.owner_id) ?? 0) + 1)

  return users
    .map((u) => {
      const p = byId.get(u.id)
      return {
        id: u.id,
        email: u.email ?? '',
        display_name: p?.display_name ?? null,
        // Cuentas de Auth sin perfil (p. ej. creadas fuera de Hamurabi) no pueden entrar.
        role: p?.role ?? null,
        status: p?.status ?? null,
        tablet_count: counts.get(u.id) ?? 0,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }
    })
    .sort((a, b) => a.email.localeCompare(b.email))
}

async function createUser(admin: SupabaseClient, body: Record<string, unknown>) {
  const email = str(body.email, 'email')!.toLowerCase()
  const password = str(body.password, 'password')!
  const display_name = str(body.display_name, 'display_name', { optional: true }) ?? null
  const role = oneOf(body.role, ROLES, 'role') ?? 'client'
  checkEmail(email)
  checkPassword(password)

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) {
    throw new HttpError(400, /already|registered|exists/i.test(error.message) ? 'Ya existe una cuenta con ese correo' : error.message)
  }
  const { error: pErr } = await admin.from('profiles').insert({ id: data.user.id, role, status: 'active', display_name })
  if (pErr) {
    // Sin perfil la cuenta no sirve: se deshace para no dejarla huérfana.
    await admin.auth.admin.deleteUser(data.user.id)
    throw pErr
  }
  return { id: data.user.id }
}

async function updateUser(admin: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  const id = str(body.id, 'id')!
  const role = oneOf(body.role, ROLES, 'role')
  const status = oneOf(body.status, STATUSES, 'status')
  const email = str(body.email, 'email', { optional: true })?.toLowerCase()
  const password = str(body.password, 'password', { optional: true })
  const display_name = body.display_name === undefined ? undefined : (str(body.display_name, 'display_name', { optional: true }) ?? null)

  if (id === callerId && (role === 'client' || status === 'suspended')) {
    throw new HttpError(400, 'No puedes quitarte el rol de administrador ni suspender tu propia cuenta')
  }

  const authPatch: { email?: string; email_confirm?: boolean; password?: string; ban_duration?: string } = {}
  if (email) {
    checkEmail(email)
    authPatch.email = email
    authPatch.email_confirm = true
  }
  if (password) {
    checkPassword(password)
    authPatch.password = password
  }
  if (status) authPatch.ban_duration = status === 'suspended' ? BAN_FOREVER : 'none'
  if (Object.keys(authPatch).length) {
    const { error } = await admin.auth.admin.updateUserById(id, authPatch)
    if (error) throw new HttpError(400, error.message)
  }

  const profilePatch: Record<string, unknown> = {}
  if (role) profilePatch.role = role
  if (status) profilePatch.status = status
  if (display_name !== undefined) profilePatch.display_name = display_name
  if (Object.keys(profilePatch).length) {
    // upsert: también repara cuentas de Auth que no tenían perfil.
    const { error } = await admin.from('profiles').upsert({ id, ...profilePatch })
    if (error) throw error
  }
  return { id }
}

async function deleteUser(admin: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  const id = str(body.id, 'id')!
  if (id === callerId) throw new HttpError(400, 'No puedes eliminar tu propia cuenta')
  // Borra en cascada su perfil, tablillas y API keys (FK on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new HttpError(400, error.message)
  return { id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const callerId = await requireAdmin(req, admin)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    switch (body.action) {
      case 'list':
        return json({ users: await listUsers(admin) })
      case 'create':
        return json(await createUser(admin, body), 201)
      case 'update':
        return json(await updateUser(admin, callerId, body))
      case 'delete':
        return json(await deleteUser(admin, callerId, body))
      default:
        return json({ error: 'Acción desconocida' }, 400)
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Error interno' }, 500)
  }
})
