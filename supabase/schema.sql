-- ============================================================
-- BIS Seguridad - Schema de base de datos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Subestaciones
create table if not exists substations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- DVRs (device_name debe coincidir exactamente con el nombre configurado en el DVR)
create table if not exists dvrs (
  id uuid primary key default gen_random_uuid(),
  substation_id uuid references substations(id) on delete cascade,
  name text not null,
  device_name text not null unique, -- ej: "DVR54"
  created_at timestamptz default now()
);

-- Eventos recibidos por mail
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  dvr_id uuid references dvrs(id) on delete cascade,
  event_type text not null,       -- ej: "Video Loss", "Motion Detection"
  channel_no text,                -- ej: "1"
  channel_name text,              -- ej: "Camera 01"
  occurred_at timestamptz not null,
  email_message_id text unique,   -- evita duplicados
  raw_body text,                  -- cuerpo del mail original (para debug)
  created_at timestamptz default now()
);

-- Perfiles de usuarios (extiende auth.users de Supabase)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz default now()
);

-- Trigger para crear perfil automáticamente al registrar usuario
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'client');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table substations enable row level security;
alter table dvrs enable row level security;
alter table events enable row level security;
alter table profiles enable row level security;

-- Substations: todos los usuarios autenticados pueden ver
create policy "Authenticated users can view substations"
  on substations for select
  to authenticated
  using (true);

-- Solo admin puede insertar/actualizar/borrar substations
create policy "Admins can manage substations"
  on substations for all
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- DVRs: todos los usuarios autenticados pueden ver
create policy "Authenticated users can view dvrs"
  on dvrs for select
  to authenticated
  using (true);

create policy "Admins can manage dvrs"
  on dvrs for all
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Events: todos los usuarios autenticados pueden ver
create policy "Authenticated users can view events"
  on events for select
  to authenticated
  using (true);

-- Solo service role puede insertar eventos (desde el cron)
create policy "Service role can insert events"
  on events for insert
  to service_role
  with check (true);

-- Profiles: cada usuario ve su propio perfil; admin ve todos
create policy "Users can view own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid());

-- ============================================================
-- Datos iniciales de prueba
-- ============================================================

insert into substations (name) values ('Subestacion 54')
  on conflict do nothing;

insert into dvrs (substation_id, name, device_name)
  select id, 'DVR54', 'DVR54' from substations where name = 'Subestacion 54'
  on conflict (device_name) do nothing;
