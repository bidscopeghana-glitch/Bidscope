-- Forward-only hardening after the initial retention schema: structured feedback and exact change severity labels.
alter table public.opportunity_feedback
  add column if not exists reason_code text
    check (reason_code in ('WRONG_SECTOR','TOO_SMALL','TOO_LARGE','WRONG_COUNTRY','NOT_ELIGIBLE','WRONG_SERVICE','DEADLINE_TOO_CLOSE','OTHER'));

alter table public.opportunity_revisions drop constraint if exists opportunity_revisions_severity_check;
update public.opportunity_revisions set severity=case severity when 'critical' then 'CRITICAL' when 'high' then 'IMPORTANT' else 'INFORMATIONAL' end;
alter table public.opportunity_revisions alter column severity set default 'INFORMATIONAL';
alter table public.opportunity_revisions add constraint opportunity_revisions_severity_check check (severity in ('CRITICAL','IMPORTANT','INFORMATIONAL'));

alter table public.procurement_opportunities
  add column if not exists cpv_codes text[] not null default '{}',
  add column if not exists unspsc_codes text[] not null default '{}',
  add column if not exists local_registration_required boolean,
  add column if not exists local_partner_required boolean,
  add column if not exists bid_security_text text,
  add column if not exists required_certifications text[] not null default '{}',
  add column if not exists required_documents jsonb not null default '[]';

create index if not exists procurement_opportunities_cpv_idx on public.procurement_opportunities using gin(cpv_codes);
create index if not exists procurement_opportunities_unspsc_idx on public.procurement_opportunities using gin(unspsc_codes);

-- Keep database-ranked discovery aligned with the authoritative deterministic matcher.
create or replace function public.customer_match(profile jsonb, opportunity jsonb) returns jsonb
language plpgsql stable set search_path=public as $$
declare terms text[]; regions text[]; codes text[]; opportunity_codes text[]; preferred_countries text[]; preferred_buyers text[]; opportunity_types text[]; earned numeric=0; possible numeric=0; reasons jsonb='[]'::jsonb; hay text;
begin
  profile=jsonb_strip_nulls(profile);
  select array_agg(lower(value)) into terms from jsonb_array_elements_text(coalesce(profile->'sectors','[]')||coalesce(profile->'services','[]')||coalesce(profile->'products','[]')||jsonb_build_array(coalesce(profile->>'business_description',''))) where trim(value)<>'';
  hay=lower(concat_ws(' ',opportunity->>'title',opportunity->>'summary',opportunity->>'sector',opportunity->>'category'));
  if cardinality(terms)>0 then possible=possible+50;if exists(select 1 from unnest(terms) t where strpos(hay,t)>0) then earned=earned+50;reasons=reasons||'"Category, service or business description matches this scope"'::jsonb;end if;end if;
  select array_agg(lower(value)) into regions from jsonb_array_elements_text(case when jsonb_array_length(coalesce(profile->'preferred_regions','[]'))>0 then profile->'preferred_regions' else jsonb_build_array(coalesce(profile->>'region','')) end) where trim(value)<>'';
  if cardinality(regions)>0 and nullif(opportunity->>'region','') is not null then possible=possible+20;if lower(opportunity->>'region')=any(regions) then earned=earned+20;reasons=reasons||'"Region matches your preferred coverage"'::jsonb;end if;end if;
  if (profile->>'preferred_minimum_value' is not null or profile->>'preferred_maximum_value' is not null) and opportunity->>'estimated_value' is not null then possible=possible+30;if (profile->>'preferred_minimum_value' is null or (opportunity->>'estimated_value')::numeric >= (profile->>'preferred_minimum_value')::numeric) and (profile->>'preferred_maximum_value' is null or (opportunity->>'estimated_value')::numeric <= (profile->>'preferred_maximum_value')::numeric) then earned=earned+30;reasons=reasons||'"Estimated value matches your preferred range"'::jsonb;end if;end if;
  if jsonb_array_length(coalesce(profile->'certifications','[]'))>0 and nullif(opportunity->>'eligibility_text','') is not null then possible=possible+15;if exists(select 1 from jsonb_array_elements_text(profile->'certifications') c where strpos(lower(opportunity->>'eligibility_text'),lower(c))>0) then earned=earned+15;reasons=reasons||'"A listed certification appears in the eligibility information"'::jsonb;end if;end if;
  select array_agg(lower(value)) into codes from jsonb_array_elements_text(coalesce(profile->'cpv_codes','[]')||coalesce(profile->'unspsc_codes','[]')) where trim(value)<>'';
  select array_agg(lower(value)) into opportunity_codes from jsonb_array_elements_text(coalesce(opportunity->'cpv_codes','[]')||coalesce(opportunity->'unspsc_codes','[]')) where trim(value)<>'';
  if cardinality(codes)>0 and cardinality(opportunity_codes)>0 then possible=possible+20;if exists(select 1 from unnest(codes) c cross join unnest(opportunity_codes) o where strpos(o,c)=1 or strpos(c,o)=1) then earned=earned+20;reasons=reasons||'"Published classification codes match your business profile"'::jsonb;end if;end if;
  select array_agg(lower(value)) into preferred_countries from jsonb_array_elements_text(coalesce(profile->'preferred_countries','[]')) where trim(value)<>'';
  if cardinality(preferred_countries)>0 and coalesce(opportunity->>'country',opportunity->>'country_code') is not null then possible=possible+15;if lower(coalesce(opportunity->>'country',''))=any(preferred_countries) or lower(coalesce(opportunity->>'country_code',''))=any(preferred_countries) then earned=earned+15;reasons=reasons||'"Country matches your procurement preferences"'::jsonb;end if;end if;
  select array_agg(lower(value)) into preferred_buyers from jsonb_array_elements_text(coalesce(profile->'preferred_buyers','[]')) where trim(value)<>'';
  if cardinality(preferred_buyers)>0 and nullif(opportunity->>'buyer_name','') is not null then possible=possible+10;if exists(select 1 from unnest(preferred_buyers) b where strpos(lower(opportunity->>'buyer_name'),b)>0) then earned=earned+10;reasons=reasons||'"This is a preferred buyer"'::jsonb;end if;end if;
  select array_agg(lower(value)) into opportunity_types from jsonb_array_elements_text(coalesce(profile->'preferred_opportunity_types','[]')) where trim(value)<>'';
  if cardinality(opportunity_types)>0 then possible=possible+10;if exists(select 1 from unnest(opportunity_types) t where strpos(lower(concat_ws(' ',opportunity->>'contract_type',opportunity->>'category')),t)>0) then earned=earned+10;reasons=reasons||'"Opportunity type matches your preferences"'::jsonb;end if;end if;
  return jsonb_build_object('percentage',case when possible>0 then round(earned/possible*100) else null end,'reasons',reasons,'evidenceAvailable',possible>0);
end $$;
revoke all on function public.customer_match(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.customer_match(jsonb,jsonb) to service_role;
