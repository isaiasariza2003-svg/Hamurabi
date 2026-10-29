-- Las funciones auxiliares de RLS no deben exponerse como RPC en /rest/v1/rpc.
-- Se mueven a un esquema no expuesto por la API. Las políticas las referencian por OID,
-- así que siguen funcionando sin recrearlas.
create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_admin() set schema private;
alter function public.is_active() set schema private;

-- Solo las políticas (que aplican a `authenticated`) necesitan ejecutarlas.
revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.is_active() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active() to authenticated;
