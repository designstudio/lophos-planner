-- LGPD-oriented account deletion audit + secure self-service delete RPC
-- Run this in Supabase SQL Editor.

create table if not exists public.account_deletion_audit (
    id bigint generated always as identity primary key,
    user_id uuid not null,
    requested_at timestamptz not null default now(),
    completed_at timestamptz,
    source text not null default 'self_service_web',
    status text not null default 'requested'
        check (status in ('requested', 'completed', 'failed')),
    error_message text,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_account_deletion_audit_user_id
    on public.account_deletion_audit (user_id);

create index if not exists idx_account_deletion_audit_requested_at
    on public.account_deletion_audit (requested_at desc);

-- RLS enabled + no direct app read/write access.
alter table public.account_deletion_audit enable row level security;

drop policy if exists account_deletion_audit_no_access on public.account_deletion_audit;
create policy account_deletion_audit_no_access
on public.account_deletion_audit
for all
using (false)
with check (false);

revoke all on table public.account_deletion_audit from anon;
revoke all on table public.account_deletion_audit from authenticated;

-- Optional: allow service_role to read logs (server-side only).
grant select on table public.account_deletion_audit to service_role;

create or replace function public.delete_user_account_with_audit(
    p_source text default 'self_service_web',
    p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_audit_id bigint;
    v_source text := coalesce(nullif(trim(p_source), ''), 'self_service_web');
begin
    if v_uid is null then
        raise exception 'Not authenticated';
    end if;

    insert into public.account_deletion_audit (user_id, source, status, metadata)
    values (v_uid, v_source, 'requested', coalesce(p_metadata, '{}'::jsonb))
    returning id into v_audit_id;

    begin
        -- Domain data first
        delete from public.tasks where uid = v_uid;
        delete from public.users where id = v_uid;

        -- Auth identity last
        delete from auth.users where id = v_uid;

        update public.account_deletion_audit
        set status = 'completed',
            completed_at = now()
        where id = v_audit_id;

    exception when others then
        update public.account_deletion_audit
        set status = 'failed',
            completed_at = now(),
            error_message = sqlerrm
        where id = v_audit_id;

        raise;
    end;
end;
$$;

revoke all on function public.delete_user_account_with_audit(text, jsonb) from public;
revoke all on function public.delete_user_account_with_audit(text, jsonb) from anon;
grant execute on function public.delete_user_account_with_audit(text, jsonb) to authenticated;
