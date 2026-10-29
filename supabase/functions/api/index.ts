// API pública de Hamurabi. Se autentica con API keys propias (no con sesiones de Supabase),
// por eso se despliega con verify_jwt = false. Cada token solo ve las tablillas de su dueño.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import pdfMake from 'npm:pdfmake@0.3.13/build/pdfmake.js'
import courier from 'npm:pdfmake@0.3.13/build/standard-fonts/Courier.js'
import helvetica from 'npm:pdfmake@0.3.13/build/standard-fonts/Helvetica.js'
import times from 'npm:pdfmake@0.3.13/build/standard-fonts/Times.js'
import { createMeasurer } from './_core/pdf/metrics.ts'
import { toPdfDefinition } from './_core/pdf/toPdfmake.ts'
import { normalizeTablet } from './_core/tablets/legacy.ts'
import { applyValues, toPlainText } from './_core/tablets/render.ts'
import type { Tablet } from './_core/tablets/types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const RATE_LIMIT_PER_MINUTE = 60
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_RE = /^hmb_[A-Za-z0-9]{32,}$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

for (const font of [times, helvetica, courier]) pdfMake.addFontContainer(font)
// Mide el texto con las mismas métricas que pdfmake, para alinear las tabulaciones.
const measure = createMeasurer([times, helvetica, courier])

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

class HttpError extends Error {
  constructor(public status: number, message: string, public headers: Record<string, string> = {}) {
    super(message)
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Devuelve el id del dueño del token. Valida formato, hash, revocación, cuenta activa y ritmo. */
async function authenticate(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new HttpError(401, 'Falta el token. Usa la cabecera Authorization: Bearer <token>')
  if (!TOKEN_RE.test(token)) throw new HttpError(401, 'Token inválido')
  const { data, error } = await db.rpc('api_authenticate', {
    p_token_hash: await sha256Hex(token),
    p_limit: RATE_LIMIT_PER_MINUTE,
  })
  if (error) throw error
  if (!data) throw new HttpError(401, 'Token inválido, revocado o de una cuenta suspendida')
  if (data.rate_limited) {
    throw new HttpError(429, `Límite de ${RATE_LIMIT_PER_MINUTE} peticiones por minuto superado`, { 'Retry-After': '60' })
  }
  return data.owner_id as string
}

/** Tablilla del dueño. 404 tanto si no existe como si es de otra cuenta, para no revelar ids ajenos. */
async function getOwnTablet(ownerId: string, id: string): Promise<Tablet> {
  if (!UUID_RE.test(id)) throw new HttpError(404, 'Tablilla no encontrada')
  const { data, error } = await db.from('tablets').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Tablilla no encontrada')
  return normalizeTablet(data as Tablet)
}

const describeTablet = (t: Tablet) => ({
  id: t.id,
  name: t.name,
  page_size: t.page_size,
  margins: t.margins,
  fields: t.fields,
  updated_at: t.updated_at,
})

function fileName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  return `${base || 'documento'}.pdf`
}

async function render(ownerId: string, id: string, req: Request): Promise<Response> {
  let body: { values?: unknown; output?: unknown }
  try {
    body = await req.json()
  } catch {
    throw new HttpError(400, 'El cuerpo debe ser JSON: { "values": { ... } }')
  }
  const values = body.values ?? {}
  if (typeof values !== 'object' || Array.isArray(values)) throw new HttpError(400, '"values" debe ser un objeto')
  const output = body.output ?? new URL(req.url).searchParams.get('output') ?? 'pdf'
  if (output !== 'pdf' && output !== 'text') throw new HttpError(400, '"output" debe ser "pdf" o "text"')

  const tablet = await getOwnTablet(ownerId, id)
  const vals = values as Record<string, unknown>
  const resolved = applyValues(tablet.content, tablet.fields, vals)
  // Los booleanos vacíos son "no", no un dato faltante.
  const missing = tablet.fields
    .filter((f) => f.type !== 'boolean' && (vals[f.key] === undefined || vals[f.key] === null || vals[f.key] === ''))
    .map((f) => f.key)

  if (output === 'text') return json({ name: tablet.name, text: toPlainText(resolved), missing })

  const definition = toPdfDefinition(
    resolved,
    { pageSize: tablet.page_size, margins: tablet.margins },
    tablet.name,
    measure,
  )
  const pdf: Uint8Array = await pdfMake.createPdf(definition).getBuffer()
  return new Response(pdf, {
    headers: {
      ...CORS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName(tablet.name)}"`,
      'X-Hamurabi-Missing': missing.join(','),
      'Access-Control-Expose-Headers': 'Content-Disposition, X-Hamurabi-Missing',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    // La URL llega como /api/<ruta>; se descarta el nombre de la función.
    const path = new URL(req.url).pathname.replace(/^.*?\/api(?=\/|$)/, '').replace(/\/+$/, '')
    const parts = path.split('/').filter(Boolean)

    if (parts[0] !== 'tablets' || parts.length > 3) throw new HttpError(404, 'Ruta no encontrada')
    const ownerId = await authenticate(req)

    if (parts.length === 1 && req.method === 'GET') {
      // Se lee el contenido para normalizar tablillas antiguas, cuyos campos vivían dentro del texto.
      const { data, error } = await db
        .from('tablets')
        .select('*')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return json({ tablets: (data as Tablet[]).map((t) => describeTablet(normalizeTablet(t))) })
    }
    if (parts.length === 2 && req.method === 'GET') {
      return json(describeTablet(await getOwnTablet(ownerId, parts[1])))
    }
    if (parts.length === 3 && parts[2] === 'render' && req.method === 'POST') {
      return await render(ownerId, parts[1], req)
    }
    throw new HttpError(404, 'Ruta no encontrada')
  } catch (e) {
    if (e instanceof HttpError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...CORS, ...e.headers, 'Content-Type': 'application/json' },
      })
    }
    console.error(e)
    return json({ error: 'Error interno' }, 500)
  }
})
