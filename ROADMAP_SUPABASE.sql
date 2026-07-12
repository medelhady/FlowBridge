create table if not exists roadmap_notes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);

alter table roadmap_notes enable row level security;

drop policy if exists "Allow admin roadmap read" on roadmap_notes;
drop policy if exists "Allow admin roadmap insert" on roadmap_notes;
drop policy if exists "Allow admin roadmap update" on roadmap_notes;
drop policy if exists "Allow admin roadmap delete" on roadmap_notes;

create policy "Allow admin roadmap read"
on roadmap_notes
for select
to anon
using (true);

create policy "Allow admin roadmap insert"
on roadmap_notes
for insert
to anon
with check (true);

create policy "Allow admin roadmap update"
on roadmap_notes
for update
to anon
using (true)
with check (true);

create policy "Allow admin roadmap delete"
on roadmap_notes
for delete
to anon
using (true);

notify pgrst, 'reload schema';
