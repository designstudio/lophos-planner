-- Multi-agenda support + agenda-level public sharing
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

-- 1) Core table for agendas
create table if not exists public.agendas (
    id uuid primary key default gen_random_uuid(),
    uid uuid not null references public.users(id) on delete cascade,
    name text not null,
    avatar text,
    color text not null default '#3b82f6',
    sort_completed_tasks boolean not null default true,
    related_links_enabled boolean not null default true,
    share_token text,
    share_enabled boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.agendas
    add column if not exists avatar text;

alter table public.agendas
    add column if not exists color text not null default '#3b82f6';

alter table public.agendas
    add column if not exists sort_completed_tasks boolean not null default true;

alter table public.agendas
    add column if not exists related_links_enabled boolean not null default true;

create unique index if not exists agendas_share_token_unique_idx
    on public.agendas (share_token)
    where share_token is not null;

create index if not exists agendas_uid_created_at_idx
    on public.agendas (uid, created_at);

-- 2) Users: current agenda pointer
alter table public.users
    add column if not exists avatar text;

alter table public.users
    add column if not exists current_agenda_id uuid;

-- FK added separately to avoid issues with order of operations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_current_agenda_id_fkey'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_current_agenda_id_fkey
            FOREIGN KEY (current_agenda_id)
            REFERENCES public.agendas(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- 3) Tasks belong to an agenda
alter table public.tasks
    add column if not exists agenda_id uuid;

alter table public.tasks
    add column if not exists is_board_task boolean not null default false;

alter table public.tasks
    add column if not exists board_column_id text;

alter table public.tasks
    add column if not exists board_order integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_agenda_id_fkey'
    ) THEN
        ALTER TABLE public.tasks
            ADD CONSTRAINT tasks_agenda_id_fkey
            FOREIGN KEY (agenda_id)
            REFERENCES public.agendas(id)
            ON DELETE CASCADE;
    END IF;
END
$$;

create index if not exists tasks_uid_agenda_date_order_idx
    on public.tasks (uid, agenda_id, date, "order");

create index if not exists tasks_agenda_board_idx
    on public.tasks (agenda_id, is_board_task, board_column_id, board_order);

-- 3b) Board columns belong to an agenda
create table if not exists public.board_columns (
    id text primary key,
    uid uuid not null references public.users(id) on delete cascade,
    agenda_id uuid not null references public.agendas(id) on delete cascade,
    title text not null default '',
    sort_order integer not null default 0,
    hidden boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.board_columns
    add column if not exists hidden boolean not null default false;

alter table public.board_columns
    add column if not exists sort_order integer not null default 0;

create index if not exists board_columns_uid_agenda_sort_idx
    on public.board_columns (uid, agenda_id, sort_order);

create or replace function public.get_agenda_board_columns(p_agenda_id uuid)
returns table (
    id text,
    uid uuid,
    agenda_id uuid,
    title text,
    sort_order integer,
    hidden boolean,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        bc.id,
        bc.uid,
        bc.agenda_id,
        bc.title,
        bc.sort_order,
        bc.hidden,
        bc.created_at
    from public.board_columns bc
    where bc.agenda_id = p_agenda_id
    order by
        bc.sort_order asc,
        bc.created_at asc,
        bc.id asc;
$$;

revoke all on function public.get_agenda_board_columns(uuid) from public;
revoke all on function public.get_agenda_board_columns(uuid) from anon;
revoke all on function public.get_agenda_board_columns(uuid) from authenticated;

grant execute on function public.get_agenda_board_columns(uuid) to anon;
grant execute on function public.get_agenda_board_columns(uuid) to authenticated;

insert into public.board_columns (id, uid, agenda_id, title, sort_order, hidden)
select
    format('board-%s-%s', a.id, seeded_columns.sort_order + 1) as id,
    a.uid,
    a.id,
    seeded_columns.title,
    seeded_columns.sort_order,
    false
from public.agendas a
cross join (
    values
        (0, 'Um dia'::text),
        (1, ''::text),
        (2, ''::text),
        (3, ''::text)
) as seeded_columns(sort_order, title)
where not exists (
    select 1
    from public.board_columns bc
    where bc.agenda_id = a.id
);

-- 4) Ensure each user has at least one default agenda named "Pessoal"
insert into public.agendas (uid, name)
select u.id, 'Pessoal'
from public.users u
where not exists (
    select 1 from public.agendas a where a.uid = u.id
);

insert into public.board_columns (id, uid, agenda_id, title, sort_order, hidden)
select
    format('board-%s-%s', a.id, seeded_columns.sort_order + 1) as id,
    a.uid,
    a.id,
    seeded_columns.title,
    seeded_columns.sort_order,
    false
from public.agendas a
cross join (
    values
        (0, 'Um dia'::text),
        (1, ''::text),
        (2, ''::text),
        (3, ''::text)
) as seeded_columns(sort_order, title)
where not exists (
    select 1
    from public.board_columns bc
    where bc.agenda_id = a.id
);

-- 5) Set current_agenda_id if empty
update public.users u
set current_agenda_id = a.id
from (
    select distinct on (uid) uid, id
    from public.agendas
    order by uid, created_at asc
) a
where u.id = a.uid
  and u.current_agenda_id is null;

-- 6) Backfill existing tasks into current agenda
update public.tasks t
set agenda_id = u.current_agenda_id
from public.users u
where t.uid = u.id
  and t.agenda_id is null
  and u.current_agenda_id is not null;

-- Optional hardening: uncomment after checking no NULLs remain
-- alter table public.tasks alter column agenda_id set not null;

create or replace function public.get_user_agendas(p_user_id uuid default auth.uid())
returns table (
    id uuid,
    uid uuid,
    name text,
    avatar text,
    color text,
    sort_completed_tasks boolean,
    related_links_enabled boolean,
    share_token text,
    share_enabled boolean,
    created_at timestamptz,
    role text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        a.id,
        a.uid,
        a.name,
        a.avatar,
        a.color,
        a.sort_completed_tasks,
        a.related_links_enabled,
        a.share_token,
        a.share_enabled,
        a.created_at,
        am.role
    from public.agendas a
    inner join public.agenda_members am
        on am.agenda_id = a.id
       and am.uid = coalesce(p_user_id, auth.uid())
    order by
        (am.role = 'owner') desc,
        a.created_at asc;
$$;

create or replace function public.get_agenda_members(p_agenda_id uuid)
returns table (
    uid uuid,
    name text,
    email text,
    avatar text,
    role text,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        am.uid,
        coalesce(nullif(trim(u.name), ''), split_part(coalesce(u.email, ''), '@', 1), 'Member') as name,
        coalesce(u.email, '') as email,
        coalesce(u.avatar, '') as avatar,
        am.role,
        am.created_at
    from public.agenda_members am
    left join public.users u
        on u.id = am.uid
    where am.agenda_id = p_agenda_id
    order by
        (am.role = 'owner') desc,
        am.created_at asc;
$$;

-- 7) RLS
alter table public.agendas enable row level security;
alter table public.tasks enable row level security;
alter table public.board_columns enable row level security;

-- Agenda policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agendas' AND policyname = 'agendas_select_own'
    ) THEN
        CREATE POLICY agendas_select_own
            ON public.agendas
            FOR SELECT
            TO authenticated
            USING (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agendas' AND policyname = 'agendas_insert_own'
    ) THEN
        CREATE POLICY agendas_insert_own
            ON public.agendas
            FOR INSERT
            TO authenticated
            WITH CHECK (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agendas' AND policyname = 'agendas_update_own'
    ) THEN
        CREATE POLICY agendas_update_own
            ON public.agendas
            FOR UPDATE
            TO authenticated
            USING (uid = auth.uid())
            WITH CHECK (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agendas' AND policyname = 'agendas_delete_own'
    ) THEN
        CREATE POLICY agendas_delete_own
            ON public.agendas
            FOR DELETE
            TO authenticated
            USING (uid = auth.uid());
    END IF;
END
$$;

-- Board columns own write policies by uid
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'board_columns' AND policyname = 'board_columns_select_own'
    ) THEN
        CREATE POLICY board_columns_select_own
            ON public.board_columns
            FOR SELECT
            TO authenticated
            USING (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'board_columns' AND policyname = 'board_columns_insert_own'
    ) THEN
        CREATE POLICY board_columns_insert_own
            ON public.board_columns
            FOR INSERT
            TO authenticated
            WITH CHECK (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'board_columns' AND policyname = 'board_columns_update_own'
    ) THEN
        CREATE POLICY board_columns_update_own
            ON public.board_columns
            FOR UPDATE
            TO authenticated
            USING (uid = auth.uid())
            WITH CHECK (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'board_columns' AND policyname = 'board_columns_delete_own'
    ) THEN
        CREATE POLICY board_columns_delete_own
            ON public.board_columns
            FOR DELETE
            TO authenticated
            USING (uid = auth.uid());
    END IF;
END
$$;

-- Public read for shared agendas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agendas' AND policyname = 'agendas_select_shared_public'
    ) THEN
        CREATE POLICY agendas_select_shared_public
            ON public.agendas
            FOR SELECT
            TO anon, authenticated
            USING (share_enabled = true AND share_token is not null);
    END IF;
END
$$;

-- Task public read only when its agenda is shared
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_select_shared_agenda_public'
    ) THEN
        CREATE POLICY tasks_select_shared_agenda_public
            ON public.tasks
            FOR SELECT
            TO anon, authenticated
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.agendas a
                    WHERE a.id = tasks.agenda_id
                      AND a.share_enabled = true
                      AND a.share_token is not null
                )
            );
    END IF;
END
$$;

-- Task own write policies by uid
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_insert_own'
    ) THEN
        CREATE POLICY tasks_insert_own
            ON public.tasks
            FOR INSERT
            TO authenticated
            WITH CHECK (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_update_own'
    ) THEN
        CREATE POLICY tasks_update_own
            ON public.tasks
            FOR UPDATE
            TO authenticated
            USING (uid = auth.uid())
            WITH CHECK (uid = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_delete_own'
    ) THEN
        CREATE POLICY tasks_delete_own
            ON public.tasks
            FOR DELETE
            TO authenticated
            USING (uid = auth.uid());
    END IF;
END
$$;
