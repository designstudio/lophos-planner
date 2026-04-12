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
    share_token text,
    share_enabled boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.agendas
    add column if not exists avatar text;

alter table public.agendas
    add column if not exists color text not null default '#3b82f6';

create unique index if not exists agendas_share_token_unique_idx
    on public.agendas (share_token)
    where share_token is not null;

create index if not exists agendas_uid_created_at_idx
    on public.agendas (uid, created_at);

-- 2) Users: current agenda pointer
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

-- 4) Ensure each user has at least one default agenda named "Pessoal"
insert into public.agendas (uid, name)
select u.id, 'Pessoal'
from public.users u
where not exists (
    select 1 from public.agendas a where a.uid = u.id
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

-- 7) RLS
alter table public.agendas enable row level security;
alter table public.tasks enable row level security;

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
