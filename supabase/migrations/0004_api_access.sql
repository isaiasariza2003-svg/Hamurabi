-- Fase 4: acceso por API key.

-- Función creada por la plantilla del proyecto; no se usa y no debe poder llamarse desde la API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Un token no cambia una vez creado: desde el navegador solo se renombra o se revoca.
revoke update on public.api_keys from authenticated;
grant update (name, revoked_at) on public.api_keys to authenticated;

-- Contador por token y minuto para limitar el ritmo de peticiones.
create table private.api_rate (
  key_id uuid primary key references public.api_keys (id) on delete cascade,
  window_start timestamptz not null,
  hits integer not null
);
alter table private.api_rate enable row level security;

-- Valida un token (por su hash SHA-256) y registra el uso en una sola llamada.
-- Devuelve null si el token no existe, está revocado o el dueño está suspendido.
create or replace function public.api_authenticate(p_token_hash text, p_limit integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key_id uuid;
  v_owner_id uuid;
  v_hits integer;
begin
  select k.id, k.owner_id into v_key_id, v_owner_id
  from public.api_keys k
  join public.profiles p on p.id = k.owner_id
  where k.token_hash = p_token_hash and k.revoked_at is null and p.status = 'active';

  if v_key_id is null then
    return null;
  end if;

  insert into private.api_rate as r (key_id, window_start, hits)
  values (v_key_id, date_trunc('minute', now()), 1)
  on conflict on constraint api_rate_pkey do update
    set hits = case when r.window_start = excluded.window_start then r.hits + 1 else 1 end,
        window_start = excluded.window_start
  returning r.hits into v_hits;

  update public.api_keys set last_used_at = now() where id = v_key_id;

  return jsonb_build_object('key_id', v_key_id, 'owner_id', v_owner_id, 'rate_limited', v_hits > p_limit);
end;
$$;

-- Solo la Edge Function (clave de servicio) puede autenticar tokens.
revoke execute on function public.api_authenticate(text, integer) from public, anon, authenticated;
grant execute on function public.api_authenticate(text, integer) to service_role;
