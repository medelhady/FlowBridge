create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  license_key text not null unique,
  email text not null,
  customer_id text,
  transaction_id text unique,
  price_id text,
  plan text not null default 'solo',
  billing text not null default 'unknown',
  device_limit integer not null default 1,
  trial_days integer not null default 7,
  active boolean not null default true,
  notes text
);

create index if not exists license_keys_email_idx
  on public.license_keys (lower(email));

create index if not exists license_keys_customer_id_idx
  on public.license_keys (customer_id);

create or replace function public.touch_license_keys_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_license_keys_updated_at on public.license_keys;

create trigger touch_license_keys_updated_at
before update on public.license_keys
for each row
execute function public.touch_license_keys_updated_at();

create table if not exists public.license_devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.license_keys(id) on delete cascade,
  device_id text not null,
  device_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (license_id, device_id)
);

create index if not exists license_devices_license_id_idx
  on public.license_devices (license_id);

create index if not exists license_devices_device_id_idx
  on public.license_devices (device_id);

alter table public.license_devices enable row level security;

notify pgrst, 'reload schema';
