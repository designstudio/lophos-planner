-- Task notes dual-format migration for BlockNote
-- Non-destructive: preserves legacy Markdown in public.tasks.description
-- Run in Supabase SQL Editor

begin;

alter table public.tasks
    add column if not exists note_format text not null default 'markdown';

alter table public.tasks
    add column if not exists note_blocks jsonb;

alter table public.tasks
    add column if not exists note_plain_text text;

alter table public.tasks
    add column if not exists note_migrated_at timestamptz;

create index if not exists tasks_note_format_idx
    on public.tasks (note_format);

commit;
