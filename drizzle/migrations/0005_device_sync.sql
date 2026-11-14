create table if not exists public.device_pairings (
  code_hash text primary key,
  blob text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.device_vaults (
  id uuid primary key,
  token_hash text not null,
  blob text not null,
  rev bigint not null default 0,
  updated_at timestamptz not null default now()
);
revoke all on public.device_pairings from anon, authenticated;
revoke all on public.device_vaults from anon, authenticated;
grant all on public.device_pairings to service_role;
grant all on public.device_vaults to service_role;
alter table public.device_pairings enable row level security;
alter table public.device_vaults enable row level security;

create or replace function public.device_pair_answer(p_hash text, p_blob text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(p_hash) <> 64 or length(p_blob) > 4000 then raise exception 'too-big'; end if;
  delete from device_pairings where created_at < now() - interval '10 minutes';
  insert into device_pairings(code_hash, blob) values (p_hash, p_blob) on conflict do nothing;
end $$;

create or replace function public.device_pair_poll(p_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare b text;
begin
  if length(p_hash) <> 64 then return null; end if;
  delete from device_pairings where code_hash = p_hash and created_at > now() - interval '10 minutes' returning blob into b;
  return b;
end $$;

create or replace function public.device_vault_push(p_id uuid, p_token text, p_blob text, p_rev bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare h text := encode(extensions.digest(p_token, 'sha256'), 'hex'); r record;
begin
  if length(p_token) < 32 or length(p_token) > 100 or length(p_blob) > 3000000 then raise exception 'too-big'; end if;
  select * into r from device_vaults where id = p_id;
  if not found then
    insert into device_vaults(id, token_hash, blob, rev) values (p_id, h, p_blob, p_rev);
    return p_rev;
  end if;
  if r.token_hash <> h then raise exception 'no-access'; end if;
  update device_vaults set blob = p_blob, rev = p_rev, updated_at = now() where id = p_id;
  return p_rev;
end $$;

create or replace function public.device_vault_pull(p_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from device_vaults where id = p_id and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then return null; end if;
  return jsonb_build_object('blob', r.blob, 'rev', r.rev);
end $$;

create or replace function public.device_vault_delete(p_id uuid, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from device_vaults where id = p_id and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
end $$;

revoke execute on function public.device_pair_answer(text, text), public.device_pair_poll(text),
  public.device_vault_push(uuid, text, text, bigint), public.device_vault_pull(uuid, text), public.device_vault_delete(uuid, text) from public;
grant execute on function public.device_pair_answer(text, text), public.device_pair_poll(text),
  public.device_vault_push(uuid, text, text, bigint), public.device_vault_pull(uuid, text), public.device_vault_delete(uuid, text) to anon, authenticated;
