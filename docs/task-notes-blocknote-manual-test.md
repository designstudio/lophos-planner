# Task Notes BlockNote Manual Test

Use this checklist after applying `docs/supabase-task-notes-blocknote.sql`.

## Legacy Markdown

- Open a task with empty notes.
- Open a task with plain text only.
- Open a task with invalid or incomplete Markdown.
- Open a task with raw legacy HTML inside the note.
- Open a task with links using Markdown syntax.
- Open a task with:
  - heading
  - bold
  - italic
  - strikethrough
  - bullet list
  - numbered list
  - quote
  - table

Expected:
- task opens without data loss
- content is visible
- no save happens automatically
- note stays in legacy mode until edited and saved

## Legacy Callout

- Open a task containing `> [!INFO]` or `> [!WARNING]`.

Expected:
- compatibility fallback is shown
- rendered content matches legacy rendering
- original Markdown remains preserved

## BlockNote Save

- Edit a legacy Markdown note that converts successfully.
- Save/close the task.

Expected:
- `tasks.note_format = 'blocknote'`
- `tasks.note_blocks` contains JSON blocks
- `tasks.description` keeps Markdown backup
- `tasks.note_plain_text` is populated
- `tasks.note_migrated_at` is populated

## BlockNote Reopen

- Reopen a task already saved as `blocknote`.

Expected:
- content loads from `note_blocks`
- formatting remains visible
- further edits continue saving JSON + Markdown backup

## Images

- Insert an image block using the BlockNote UI.
- Save and reopen the task.

Expected:
- the image block stays in the editor JSON
- the task still has a Markdown backup in `description`

## Public Share

- Open a shared agenda containing:
  - a legacy Markdown task
  - a migrated BlockNote task

Expected:
- both remain visible in the public view
- migrated tasks still render through the Markdown backup
