begin;

-- Procurement mutations are deliberately server mediated.  The API applies
-- subscription, invitation, deadline, verification, role and sealed-opening
-- checks; an authenticated PostgREST client must not be able to bypass them.
revoke all on table public.procurement_tenders from authenticated, public;
revoke all on table public.supplier_bids from authenticated, public;
revoke all on table public.procurement_tender_lots from authenticated, public;
revoke all on table public.procurement_requirements from authenticated, public;
revoke all on table public.procurement_required_documents from authenticated, public;
revoke all on table public.procurement_tender_documents from authenticated, public;
revoke all on table public.procurement_evaluation_criteria from authenticated, public;
revoke all on table public.tender_invitations from authenticated, public;
revoke all on table public.supplier_bid_versions from authenticated, public;
revoke all on table public.supplier_bid_lots from authenticated, public;
revoke all on table public.supplier_bid_responses from authenticated, public;
revoke all on table public.supplier_bid_documents from authenticated, public;
revoke all on table public.tender_clarifications from authenticated, public;
revoke all on table public.procurement_evaluation_assignments from authenticated, public;
revoke all on table public.bid_evaluations from authenticated, public;
revoke all on table public.evaluation_scores from authenticated, public;
revoke all on table public.tender_shortlists from authenticated, public;
revoke all on table public.procurement_awards from authenticated, public;
revoke all on table public.procurement_award_lots from authenticated, public;

-- Keep the limited, organisation-owned read surfaces that do not expose bid
-- content.  All tender/bid detail remains behind the application API.
grant select on table public.buyer_verifications,
  public.procurement_audit_logs to authenticated;

-- SECURITY DEFINER functions are executable by PUBLIC unless explicitly
-- revoked.  They still use auth.uid(), but narrowing invocation prevents an
-- anonymous metadata oracle and documents the intended boundary.
revoke execute on function public.procurement_role_for(uuid) from public, anon;
revoke execute on function public.can_manage_procurement(uuid) from public, anon;
revoke execute on function public.can_evaluate_tender(uuid) from public, anon;
revoke execute on function public.can_view_bid(uuid) from public, anon;
grant execute on function public.procurement_role_for(uuid),
  public.can_manage_procurement(uuid),
  public.can_evaluate_tender(uuid),
  public.can_view_bid(uuid) to authenticated, service_role;

-- "All participants" means the buyer organisation, an invited organisation,
-- or an organisation with a bid.  It must never mean every signed-in user.
drop policy if exists clarifications_party_read on public.tender_clarifications;
create policy clarifications_party_read
on public.tender_clarifications for select to authenticated
using (
  visibility = 'public'
  or public.is_organization_member(requester_organization_id)
  or (
    recipient_organization_id is not null
    and public.is_organization_member(recipient_organization_id)
  )
  or (
    visibility = 'all_participants'
    and exists (
      select 1
      from public.procurement_tenders t
      where t.id = tender_id
        and (
          public.is_organization_member(t.organization_id)
          or exists (
            select 1 from public.tender_invitations i
            where i.tender_id = t.id
              and public.is_organization_member(i.supplier_organization_id)
              and i.status <> 'revoked'
          )
          or exists (
            select 1 from public.supplier_bids b
            where b.tender_id = t.id
              and public.is_organization_member(b.supplier_organization_id)
          )
        )
    )
  )
);

create or replace function public.validate_procurement_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_tender uuid;
  scoped_tender uuid;
  bid_supplier uuid;
begin
  if tg_table_name = 'supplier_bid_lots' then
    select tender_id into expected_tender from public.supplier_bids where id = new.bid_id;
    select tender_id into scoped_tender from public.procurement_tender_lots where id = new.lot_id;
  elsif tg_table_name = 'supplier_bid_responses' then
    select tender_id into expected_tender from public.supplier_bids where id = new.bid_id;
    if new.requirement_id is not null then
      select tender_id into scoped_tender from public.procurement_requirements where id = new.requirement_id;
    else
      select tender_id into scoped_tender from public.procurement_evaluation_criteria where id = new.criterion_id;
    end if;
  elsif tg_table_name = 'procurement_evaluation_assignments' then
    expected_tender := new.tender_id;
    if new.bid_id is not null then
      select tender_id into scoped_tender from public.supplier_bids where id = new.bid_id;
      if scoped_tender is distinct from expected_tender then raise exception 'evaluation bid is outside tender'; end if;
    end if;
    if new.criterion_id is not null then
      select tender_id into scoped_tender from public.procurement_evaluation_criteria where id = new.criterion_id;
      if scoped_tender is distinct from expected_tender then raise exception 'evaluation criterion is outside tender'; end if;
    end if;
    if new.lot_id is not null then
      select tender_id into scoped_tender from public.procurement_tender_lots where id = new.lot_id;
    else
      scoped_tender := expected_tender;
    end if;
  elsif tg_table_name = 'bid_evaluations' then
    expected_tender := new.tender_id;
    select tender_id into scoped_tender from public.supplier_bids where id = new.bid_id;
    if scoped_tender is distinct from expected_tender then raise exception 'evaluation bid is outside tender'; end if;
    if new.lot_id is not null then
      select tender_id into scoped_tender from public.procurement_tender_lots where id = new.lot_id;
    else
      scoped_tender := expected_tender;
    end if;
  elsif tg_table_name = 'tender_shortlists' then
    expected_tender := new.tender_id;
    select tender_id into scoped_tender from public.supplier_bids where id = new.bid_id;
    if scoped_tender is distinct from expected_tender then raise exception 'shortlist bid is outside tender'; end if;
    if new.lot_id is not null then
      select tender_id into scoped_tender from public.procurement_tender_lots where id = new.lot_id;
    else
      scoped_tender := expected_tender;
    end if;
  elsif tg_table_name = 'procurement_awards' then
    expected_tender := new.tender_id;
    select tender_id, supplier_organization_id
      into scoped_tender, bid_supplier
      from public.supplier_bids where id = new.bid_id;
    if scoped_tender is distinct from expected_tender then raise exception 'award bid is outside tender'; end if;
    if bid_supplier is distinct from new.supplier_organization_id then raise exception 'award supplier does not own bid'; end if;
    return new;
  elsif tg_table_name = 'tender_clarifications' and new.bid_id is not null then
    expected_tender := new.tender_id;
    select tender_id into scoped_tender from public.supplier_bids where id = new.bid_id;
  else
    return new;
  end if;

  if scoped_tender is distinct from expected_tender then
    raise exception 'procurement child record is outside tender';
  end if;
  return new;
end;
$$;

create or replace function public.validate_procurement_award_lot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  award_tender uuid;
  lot_tender uuid;
begin
  select tender_id into award_tender from public.procurement_awards where id = new.award_id;
  select tender_id into lot_tender from public.procurement_tender_lots where id = new.lot_id;
  if lot_tender is distinct from award_tender then
    raise exception 'award lot is outside tender';
  end if;
  if exists (
    select 1
    from public.procurement_award_lots al
    join public.procurement_awards a on a.id = al.award_id
    where al.lot_id = new.lot_id
      and al.award_id <> new.award_id
      and a.approval_status <> 'rejected'
  ) then
    raise exception 'lot already has an active award';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_bid_lots_scope on public.supplier_bid_lots;
create trigger supplier_bid_lots_scope before insert or update on public.supplier_bid_lots
for each row execute function public.validate_procurement_scope();
drop trigger if exists supplier_bid_responses_scope on public.supplier_bid_responses;
create trigger supplier_bid_responses_scope before insert or update on public.supplier_bid_responses
for each row execute function public.validate_procurement_scope();
drop trigger if exists procurement_eval_assignments_scope on public.procurement_evaluation_assignments;
create trigger procurement_eval_assignments_scope before insert or update on public.procurement_evaluation_assignments
for each row execute function public.validate_procurement_scope();
drop trigger if exists bid_evaluations_scope on public.bid_evaluations;
create trigger bid_evaluations_scope before insert or update on public.bid_evaluations
for each row execute function public.validate_procurement_scope();
drop trigger if exists tender_shortlists_scope on public.tender_shortlists;
create trigger tender_shortlists_scope before insert or update on public.tender_shortlists
for each row execute function public.validate_procurement_scope();
drop trigger if exists procurement_awards_scope on public.procurement_awards;
create trigger procurement_awards_scope before insert or update on public.procurement_awards
for each row execute function public.validate_procurement_scope();
drop trigger if exists tender_clarifications_scope on public.tender_clarifications;
create trigger tender_clarifications_scope before insert or update on public.tender_clarifications
for each row execute function public.validate_procurement_scope();
drop trigger if exists procurement_award_lots_scope on public.procurement_award_lots;
create trigger procurement_award_lots_scope before insert or update on public.procurement_award_lots
for each row execute function public.validate_procurement_award_lot();

revoke execute on function public.validate_procurement_scope() from public, anon, authenticated;
revoke execute on function public.validate_procurement_award_lot() from public, anon, authenticated;

commit;
