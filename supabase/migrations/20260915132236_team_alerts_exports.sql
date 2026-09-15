-- Package-backed collaboration and alert delivery controls.
alter table public.customer_saved_searches
  add column if not exists delivery_recipients text[] not null default '{}';

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email) and length(email) between 3 and 320),
  role text not null default 'member' check (role in ('admin','member')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_invitations_pending_email_idx
  on public.organization_invitations (organization_id, lower(email)) where status = 'pending';
create index if not exists organization_invitations_org_idx
  on public.organization_invitations (organization_id, created_at desc);

drop trigger if exists organization_invitations_set_updated_at on public.organization_invitations;
create trigger organization_invitations_set_updated_at before update on public.organization_invitations
for each row execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;
create policy organization_invitations_admin_read on public.organization_invitations
for select to authenticated using (public.is_organization_admin(organization_id));
create policy organization_invitations_admin_insert on public.organization_invitations
for insert to authenticated with check (public.is_organization_admin(organization_id) and invited_by = auth.uid());
create policy organization_invitations_admin_update on public.organization_invitations
for update to authenticated using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));

revoke all on public.organization_invitations from anon;
grant select, insert, update on public.organization_invitations to authenticated;
grant all on public.organization_invitations to service_role;

update public.billing_plans set
  limits = limits || '{"team_seats":1,"alert_recipients":1}'::jsonb,
  updated_at = now()
where code = 'free';
