begin;

alter table public.agendas
    add column if not exists holidays_enabled boolean not null default true;

create or replace function public.get_user_agendas(p_user_id uuid default auth.uid())
returns table (
    id uuid,
    uid uuid,
    name text,
    avatar text,
    color text,
    sort_completed_tasks boolean,
    related_links_enabled boolean,
    holidays_enabled boolean,
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
        a.holidays_enabled,
        a.share_token,
        a.share_enabled,
        a.created_at,
        am.role
    from public.agendas a
    inner join public.agenda_members am
        on am.agenda_id = a.id
       and am.uid = auth.uid()
    where coalesce(p_user_id, auth.uid()) = auth.uid()
    order by
        (am.role = 'owner') desc,
        a.created_at asc;
$$;

revoke all on function public.get_user_agendas(uuid) from public;
revoke all on function public.get_user_agendas(uuid) from anon;
revoke all on function public.get_user_agendas(uuid) from authenticated;
grant execute on function public.get_user_agendas(uuid) to authenticated;

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
    v_board_columns jsonb;
    v_token text := nullif(trim(p_share_token), '');
begin
    if v_token is null then
        return null;
    end if;

    select
        a.id,
        a.uid,
        a.name,
        a.avatar,
        a.color,
        a.sort_completed_tasks,
        a.related_links_enabled,
        a.holidays_enabled
    into v_agenda
    from public.agendas a
    where a.share_token = v_token
      and a.share_enabled = true
    limit 1;

    if not found then
        return null;
    end if;

    select
        u.name,
        u.language,
        u.date_format,
        u.week_starts_on
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
    where t.agenda_id = v_agenda.id;

    select coalesce(
        jsonb_agg(
            to_jsonb(bc) order by bc.sort_order, bc.id
        ),
        '[]'::jsonb
    )
    into v_board_columns
    from public.board_columns bc
    where bc.agenda_id = v_agenda.id
      and coalesce(bc.hidden, false) = false;

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
            'color', coalesce(v_agenda.color, 'var(--color-brand-accent)'),
            'sort_completed_tasks', coalesce(v_agenda.sort_completed_tasks, true),
            'related_links_enabled', coalesce(v_agenda.related_links_enabled, true),
            'holidays_enabled', coalesce(v_agenda.holidays_enabled, true)
        ),
        'tasks', v_tasks,
        'boardColumns', v_board_columns
    );
end;
$$;

notify pgrst, 'reload schema';

commit;
