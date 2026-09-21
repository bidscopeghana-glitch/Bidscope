begin;

create schema if not exists private;
revoke all on schema private from public,anon;

create table if not exists public.tender_conversations (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.procurement_tenders(id) on delete cascade,
  supplier_bid_id uuid not null unique references public.supplier_bids(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed')),
  buyer_last_read_at timestamptz,
  supplier_last_read_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_organization_id <> supplier_organization_id)
);

create table if not exists public.tender_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tender_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sender_organization_id uuid not null references public.organizations(id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists tender_conversations_buyer_idx
  on public.tender_conversations(buyer_organization_id,last_message_at desc nulls last,created_at desc);
create index if not exists tender_conversations_supplier_idx
  on public.tender_conversations(supplier_organization_id,last_message_at desc nulls last,created_at desc);
create index if not exists tender_messages_conversation_idx
  on public.tender_messages(conversation_id,created_at asc);

create or replace function public.validate_tender_conversation()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  linked_bid public.supplier_bids%rowtype;
  linked_tender public.procurement_tenders%rowtype;
begin
  select * into linked_bid from public.supplier_bids where id=new.supplier_bid_id;
  if linked_bid.id is null then raise exception 'Supplier bid not found'; end if;
  select * into linked_tender from public.procurement_tenders where id=linked_bid.tender_id;
  if linked_tender.id is null then raise exception 'Managed tender not found'; end if;
  if linked_bid.status in ('draft','withdrawn') then
    raise exception 'Chat requires a submitted managed tender bid';
  end if;
  if linked_tender.bid_opening_model='sealed'
    and linked_tender.bids_opened_at is null
    and now()<linked_tender.submission_deadline then
    raise exception 'Chat is unavailable while this bid remains sealed';
  end if;
  if new.tender_id<>linked_bid.tender_id
    or new.supplier_organization_id<>linked_bid.supplier_organization_id
    or new.buyer_organization_id<>linked_tender.organization_id then
    raise exception 'Conversation participants do not match the managed tender bid';
  end if;
  return new;
end;
$$;

create or replace function private.can_access_tender_conversation(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.tender_conversations c
    where (select auth.uid()) is not null and c.id=p_conversation_id and (
      public.is_organization_member(c.supplier_organization_id)
      or public.can_manage_procurement(c.buyer_organization_id)
    )
  );
$$;

create or replace function public.validate_tender_message()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  conversation public.tender_conversations%rowtype;
begin
  select * into conversation from public.tender_conversations where id=new.conversation_id;
  if conversation.id is null then raise exception 'Conversation not found'; end if;
  if conversation.status<>'open' then raise exception 'Conversation is closed'; end if;
  if new.sender_organization_id not in (conversation.buyer_organization_id,conversation.supplier_organization_id) then
    raise exception 'Sender is not a conversation participant';
  end if;
  return new;
end;
$$;

create or replace function public.touch_tender_conversation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.tender_conversations
  set last_message_at=new.created_at,updated_at=new.created_at
  where id=new.conversation_id;
  return new;
end;
$$;

drop trigger if exists tender_conversations_validate on public.tender_conversations;
create trigger tender_conversations_validate before insert or update of tender_id,supplier_bid_id,buyer_organization_id,supplier_organization_id
  on public.tender_conversations for each row execute function public.validate_tender_conversation();
drop trigger if exists tender_conversations_set_updated_at on public.tender_conversations;
create trigger tender_conversations_set_updated_at before update on public.tender_conversations
  for each row execute function public.set_updated_at();
drop trigger if exists tender_messages_validate on public.tender_messages;
create trigger tender_messages_validate before insert on public.tender_messages
  for each row execute function public.validate_tender_message();
drop trigger if exists tender_messages_touch_conversation on public.tender_messages;
create trigger tender_messages_touch_conversation after insert on public.tender_messages
  for each row execute function public.touch_tender_conversation();

alter table public.tender_conversations enable row level security;
alter table public.tender_messages enable row level security;

drop policy if exists tender_conversations_participant_read on public.tender_conversations;
create policy tender_conversations_participant_read on public.tender_conversations for select to authenticated
  using((select private.can_access_tender_conversation(id)));
drop policy if exists tender_conversations_participant_insert on public.tender_conversations;
create policy tender_conversations_participant_insert on public.tender_conversations for insert to authenticated
  with check(
    created_by=(select auth.uid())
    and (
      public.can_manage_procurement(buyer_organization_id)
      or public.is_organization_member(supplier_organization_id)
    )
  );
drop policy if exists tender_messages_participant_read on public.tender_messages;
create policy tender_messages_participant_read on public.tender_messages for select to authenticated
  using((select private.can_access_tender_conversation(conversation_id)));
drop policy if exists tender_messages_participant_insert on public.tender_messages;
create policy tender_messages_participant_insert on public.tender_messages for insert to authenticated
  with check(
    sender_user_id=auth.uid()
    and (select private.can_access_tender_conversation(conversation_id))
    and public.is_organization_member(sender_organization_id)
  );

revoke all on public.tender_conversations,public.tender_messages from anon,authenticated;
grant select,insert on public.tender_conversations,public.tender_messages to authenticated;
grant all on public.tender_conversations,public.tender_messages to service_role;
revoke execute on function public.validate_tender_conversation() from public,anon,authenticated;
revoke execute on function public.validate_tender_message() from public,anon,authenticated;
revoke execute on function public.touch_tender_conversation() from public,anon,authenticated;
revoke execute on function private.can_access_tender_conversation(uuid) from public,anon;
grant usage on schema private to authenticated,service_role;
grant execute on function private.can_access_tender_conversation(uuid) to authenticated,service_role;

commit;
