import type { JSONContent } from '@tiptap/core'
import { supabase } from '../supabase/client'
import { normalizeTablet } from './legacy'
import type { FieldDef, Margins, PageSize, Tablet } from './types'

const TABLE = 'tablets'

/**
 * Tablillas de un dueño. El filtro es necesario: RLS deja al administrador ver las de todos,
 * y "Mis tablillas" solo debe mostrar las propias.
 */
export async function listTablets(ownerId: string): Promise<Tablet[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as Tablet[]).map(normalizeTablet)
}

/** Todas las tablillas visibles (para el administrador, las de todos los usuarios). Sin el contenido. */
export async function listAllTablets(): Promise<Omit<Tablet, 'content'>[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, owner_id, name, page_size, margins, fields, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Omit<Tablet, 'content'>[]
}

export async function getTablet(id: string): Promise<Tablet> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
  if (error) throw error
  return normalizeTablet(data as Tablet)
}

export async function createTablet(ownerId: string, name: string): Promise<Tablet> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      owner_id: ownerId,
      name,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    .select('*')
    .single()
  if (error) throw error
  return normalizeTablet(data as Tablet)
}

export interface TabletUpdate {
  name?: string
  page_size?: PageSize
  margins?: Margins
  content?: JSONContent
  fields?: FieldDef[]
}

export async function updateTablet(id: string, patch: TabletUpdate): Promise<Tablet> {
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return normalizeTablet(data as Tablet)
}

export async function deleteTablet(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
