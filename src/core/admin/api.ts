import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import type { Profile } from '../tablets/types'

export interface AdminUser {
  id: string
  email: string
  display_name: string | null
  /** null: cuenta de Auth sin perfil de Hamurabi (no puede entrar). */
  role: Profile['role'] | null
  status: Profile['status'] | null
  tablet_count: number
  created_at: string
  last_sign_in_at: string | null
}

export interface NewUser {
  email: string
  password: string
  display_name?: string
  role: Profile['role']
}

export interface UserPatch {
  id: string
  email?: string
  password?: string
  display_name?: string | null
  role?: Profile['role']
  status?: Profile['status']
}

/** Llama a la Edge Function admin-users y devuelve el mensaje de error que ella envía. */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error ?? 'Error del servidor')
    }
    throw error
  }
  return data as T
}

export async function listUsers(): Promise<AdminUser[]> {
  return (await call<{ users: AdminUser[] }>({ action: 'list' })).users
}

export const createUser = (user: NewUser) => call<{ id: string }>({ action: 'create', ...user })
export const updateUser = (patch: UserPatch) => call<{ id: string }>({ action: 'update', ...patch })
export const deleteUser = (id: string) => call<{ id: string }>({ action: 'delete', id })
