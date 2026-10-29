import { supabase } from '../supabase/client'
import { generateToken, sha256Hex, tokenPrefix } from './token'

export interface ApiKey {
  id: string
  name: string
  /** Inicio visible del token, para reconocerlo sin guardarlo. */
  prefix: string
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

export const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`

const COLUMNS = 'id, name, prefix, revoked_at, last_used_at, created_at'

export async function listApiKeys(ownerId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select(COLUMNS)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ApiKey[]
}

/** Crea una key. El token completo solo existe en la respuesta: en la base queda su hash. */
export async function createApiKey(ownerId: string, name: string): Promise<{ key: ApiKey; token: string }> {
  const token = generateToken()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ owner_id: ownerId, name, token_hash: await sha256Hex(token), prefix: tokenPrefix(token) })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return { key: data as ApiKey, token }
}

export async function revokeApiKey(id: string): Promise<void> {
  const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteApiKey(id: string): Promise<void> {
  const { error } = await supabase.from('api_keys').delete().eq('id', id)
  if (error) throw error
}
