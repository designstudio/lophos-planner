-- Secure public share by token using RPC (no direct anon SELECT on base tables)
-- Run in Supabase SQL Editor

begin;

-- Remove broad public-read policies from base tables (if they still exist)
drop policy if exists agendas_select_shared_public on public.agendas;
drop policy if exists tasks_select_shared_agenda_public on public.tasks;
drop policy if exists users_select_shared_public on public.users;

-- Token-gated public reader
create or replace function public.get_public_agenda_by_share_token(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_agenda record;
    v_owner record;
    v_tasks jsonb;
    v_token text := nullif(trim(p_share_token), '');
begin
    if v_token is null then
        return null;
    end if;

    select a.id, a.uid, a.name, a.avatar, a.color, a.sort_completed_tasks, a.related_links_enabled
      into v_agenda
      from public.agendas a
         where a.share_token = v_token
       and a.share_enabled = true
     limit 1;

    if not found then
        return null;
    end if;

    select u.name, u.language, u.date_format, u.week_starts_on
      into v_owner
      from public.users u
     where u.id = v_agenda.uid
     limit 1;

    if not found then
        return null;
    end if;

    select coalesce(
        jsonb_agg(
            (to_jsonb(t) - 'uid')
            order by t."order", t.id
        ),
        '[]'::jsonb
    )
      into v_tasks
      from public.tasks t
     where t.agenda_id = v_agenda.id
       and t.uid = v_agenda.uid
       and coalesce(t.is_board_task, false) = false;

    return jsonb_build_object(
        'owner', jsonb_build_object(
            'name', v_owner.name,
            'language', coalesce(v_owner.language, 'ptBR'),
            'dateFormat', coalesce(v_owner.date_format, 'DD-MM'),
            'weekStartsOn', coalesce(v_owner.week_starts_on, 'Monday')
        ),
        'agenda', jsonb_build_object(
            'id', v_agenda.id,
            'name', v_agenda.name,
            'avatar', coalesce(v_agenda.avatar, ''),
            'color', coalesce(v_agenda.color, '#3b82f6'),
            'sort_completed_tasks', coalesce(v_agenda.sort_completed_tasks, true),
            'related_links_enabled', coalesce(v_agenda.related_links_enabled, true)
        ),
        'tasks', v_tasks
    );
end;
$$;

revoke all on function public.get_public_agenda_by_share_token(text) from public;
revoke all on function public.get_public_agenda_by_share_token(text) from anon;
revoke all on function public.get_public_agenda_by_share_token(text) from authenticated;

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant execute on function public.get_public_agenda_by_share_token(text) to anon;
grant execute on function public.get_public_agenda_by_share_token(text) to authenticated;

notify pgrst, 'reload schema';

commit;
