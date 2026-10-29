-- Esquema inicial de Hamurabi: perfiles, tablillas y API keys con RLS.

create extension if not exists pgcrypto;

-- Perfiles: uno por cuenta de auth.users. Solo el administrador los crea (Edge Function con service role).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  display_name text,
  created_at timestamptz not null default now()
);

-- Tablillas: plantillas de texto. content es el documento TipTap (JSON); fields define las etiquetas.
create table public.tablets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  page_size text not null default 'letter' check (page_size in ('letter', 'legal')),
  content jsonb not null default '{}'::jsonb,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tablets_owner_id_idx on public.tablets (owner_id);

-- API keys: solo se guarda el hash SHA-256 del token; el token en claro se muestra una única vez.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  prefix text not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_keys_owner_id_idx on public.api_keys (owner_id);

-- Funciones auxiliares para RLS. security definer evita la recursión de políticas sobre profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tablets_set_updated_at
  before update on public.tablets
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.tablets enable row level security;
alter table public.api_keys enable row level security;

-- profiles: cada cuenta ve su perfil; el admin ve y gestiona todos.
create policy "profiles: ver propio o admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: admin gestiona"
  on public.profiles for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- tablets: el dueño opera sobre las suyas si su cuenta está activa; el admin sobre todas.
create policy "tablets: dueño activo"
  on public.tablets for all
  to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_active()))
  with check (owner_id = (select auth.uid()) and (select public.is_active()));

create policy "tablets: admin"
  on public.tablets for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- api_keys: el dueño administra sus tokens si su cuenta está activa; el admin ve y revoca todos.
create policy "api_keys: dueño activo"
  on public.api_keys for all
  to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_active()))
  with check (owner_id = (select auth.uid()) and (select public.is_active()));

create policy "api_keys: admin"
  on public.api_keys for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
