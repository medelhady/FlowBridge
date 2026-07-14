create table if not exists paddle_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null,
  event_type text,
  email text,
  customer_id text,
  message text
);

alter table paddle_webhook_logs enable row level security;

drop policy if exists "Allow service role webhook logs" on paddle_webhook_logs;

create policy "Allow service role webhook logs"
on paddle_webhook_logs
for all
to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';
