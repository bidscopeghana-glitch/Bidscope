begin;
create table public.response_library (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete restrict,
 title text not null check(length(title) between 1 and 200),
 category text not null check(length(category) between 1 and 80),
 tags text[] not null default '{}',
 draft_content text not null check(length(draft_content) between 1 and 30000),
 revision integer not null default 1,
 approved_version integer,
 review_date date,
 archived boolean not null default false,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index response_library_org_idx on public.response_library(organization_id,updated_at desc);
create table public.response_library_versions (
 id uuid primary key default gen_random_uuid(),
 answer_id uuid not null references public.response_library(id) on delete restrict,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 version integer not null,
 title text not null, category text not null, tags text[] not null,
 content text not null, review_date date,
 approved_by uuid not null references auth.users(id) on delete restrict,
 approved_at timestamptz not null default now(),
 unique(answer_id,version)
);
create index response_library_versions_org_idx on public.response_library_versions(organization_id,answer_id);
alter table public.response_library enable row level security;
alter table public.response_library_versions enable row level security;
create policy response_library_member_read on public.response_library for select to authenticated
 using(public.is_organization_member(organization_id));
create policy response_library_versions_member_read on public.response_library_versions for select to authenticated
 using(public.is_organization_member(organization_id));
revoke all on public.response_library, public.response_library_versions from anon,authenticated;
grant select on public.response_library, public.response_library_versions to authenticated;
grant select,insert,update on public.response_library to service_role;
grant select,insert on public.response_library_versions to service_role;

create function public.response_library_version_immutable() returns trigger
 language plpgsql set search_path=public as $$
 begin raise exception 'Approved answer versions are immutable'; end;
$$;
create trigger response_library_version_immutable before update or delete on public.response_library_versions
 for each row execute function public.response_library_version_immutable();

-- Server-only atomic mutation. The actor comes from validated Supabase Auth,
-- never from client JSON. Locking and revision comparison prevent lost updates.
create function public.mutate_response_library(p_actor uuid,p_organization uuid,p_action text,p_id uuid,p_revision integer,p_value jsonb)
 returns jsonb language plpgsql security invoker set search_path=public as $$
declare item public.response_library; prior jsonb; member_role text;
begin
 select role into member_role from public.organization_members where organization_id=p_organization and user_id=p_actor;
 if member_role is null then raise exception 'Organisation access denied' using errcode='42501'; end if;
 if p_action not in ('create','save','approve','archive') then raise exception 'Invalid action' using errcode='22023'; end if;
 if p_action='create' then
  insert into public.response_library(organization_id,owner_id,title,category,tags,draft_content,review_date)
  values(p_organization,p_actor,p_value->>'title',p_value->>'category',array(select jsonb_array_elements_text(coalesce(p_value->'tags','[]'::jsonb))),p_value->>'content',nullif(p_value->>'reviewDate','')::date)
  returning * into item;
 else
  select * into item from public.response_library where id=p_id and organization_id=p_organization for update;
  if item.id is null then raise exception 'Answer not found' using errcode='P0002'; end if;
  if item.revision<>p_revision then raise exception 'Answer changed; reload before saving' using errcode='40001'; end if;
  prior=to_jsonb(item)-'draft_content';
  if p_action in ('approve','archive') and member_role not in ('owner','admin') then
   raise exception 'Administrator approval required' using errcode='42501';
  end if;
  if item.archived then raise exception 'Archived answers cannot be changed' using errcode='22023'; end if;
  if p_action='save' then
   update public.response_library set title=p_value->>'title',category=p_value->>'category',
    tags=array(select jsonb_array_elements_text(coalesce(p_value->'tags','[]'::jsonb))),
    draft_content=p_value->>'content',review_date=nullif(p_value->>'reviewDate','')::date,
    revision=revision+1,updated_at=now() where id=item.id returning * into item;
  elsif p_action='approve' then
   if item.review_date is not null and item.review_date<current_date then raise exception 'Set a current review date before approval' using errcode='22023'; end if;
   insert into public.response_library_versions(answer_id,organization_id,version,title,category,tags,content,review_date,approved_by)
   values(item.id,p_organization,coalesce(item.approved_version,0)+1,item.title,item.category,item.tags,item.draft_content,item.review_date,p_actor);
   update public.response_library set approved_version=coalesce(approved_version,0)+1,revision=revision+1,updated_at=now() where id=item.id returning * into item;
  else
   update public.response_library set archived=true,revision=revision+1,updated_at=now() where id=item.id returning * into item;
  end if;
 end if;
 insert into public.procurement_audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
 values(p_organization,p_actor,'response_library_'||p_action,'response_library',item.id,prior,to_jsonb(item)-'draft_content');
 return to_jsonb(item);
end;
$$;
revoke all on function public.mutate_response_library(uuid,uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_response_library(uuid,uuid,text,uuid,integer,jsonb) to service_role;
commit;
