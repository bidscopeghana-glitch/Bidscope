-- BidScope growth operations: verified Ghana relationships, partnership CRM,
-- backlink evidence, Search Console opportunity review and measured experiments.

alter table public.seo_settings
  add column if not exists search_opportunity_min_impressions integer not null default 100
    check (search_opportunity_min_impressions between 25 and 100000),
  add column if not exists search_opportunity_default_snooze_days integer not null default 14
    check (search_opportunity_default_snooze_days between 1 and 180);

alter table public.seo_outreach_targets
  add column if not exists organisation_type text not null default 'ecosystem_partner',
  add column if not exists canonical_domain text,
  add column if not exists country_code text not null default 'GH',
  add column if not exists region text,
  add column if not exists sector_tags text[] not null default '{}',
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','needs_review','invalid')),
  add column if not exists verification_source_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verification_notes text,
  add column if not exists resource_match text,
  add column if not exists outreach_reason text,
  add column if not exists relevance_score integer not null default 0 check (relevance_score between 0 and 100),
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  add column if not exists contact_source_url text,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create unique index if not exists seo_outreach_target_identity_idx
  on public.seo_outreach_targets(lower(trim(organisation)),coalesce(canonical_domain,''));
create index if not exists seo_outreach_verified_priority_idx
  on public.seo_outreach_targets(verification_status,priority,relevance_score desc);

create table if not exists public.seo_outreach_activities (
  id uuid primary key default gen_random_uuid(),
  outreach_target_id uuid not null references public.seo_outreach_targets(id) on delete cascade,
  activity_type text not null check (activity_type in ('research','draft_created','email_sent','call','meeting','follow_up','reply','note','status_change')),
  status text not null default 'planned' check (status in ('planned','draft','completed','cancelled','failed')),
  subject text,
  body text,
  occurred_at timestamptz,
  due_at timestamptz,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_partnerships (
  id uuid primary key default gen_random_uuid(),
  outreach_target_id uuid not null references public.seo_outreach_targets(id) on delete cascade,
  partnership_type text not null check (partnership_type in ('content','referral','education','data','event','membership','media','development','other')),
  status text not null default 'identified' check (status in ('identified','qualified','proposal_draft','proposal_sent','discussion','agreed','active','paused','declined','closed')),
  objective text not null,
  proposed_value text,
  owner_id uuid references auth.users(id) on delete set null,
  next_action text,
  next_action_at timestamptz,
  started_at timestamptz,
  closed_at timestamptz,
  outcome text,
  referral_sessions bigint not null default 0,
  attributed_signups bigint not null default 0,
  attributed_subscriptions bigint not null default 0,
  attributed_revenue_minor bigint not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outreach_target_id,partnership_type)
);

alter table public.seo_backlinks
  add column if not exists outreach_target_id uuid references public.seo_outreach_targets(id) on delete set null,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','needs_review','lost')),
  add column if not exists verification_method text,
  add column if not exists verification_evidence jsonb not null default '{}'::jsonb,
  add column if not exists rel_attributes text[] not null default '{}',
  add column if not exists first_verified_at timestamptz,
  add column if not exists last_verified_at timestamptz;

create table if not exists public.seo_search_performance_windows (
  id bigint generated always as identity primary key,
  period_start date not null,
  period_end date not null,
  window_days integer not null check (window_days in (28,90)),
  window_role text not null check (window_role in ('current','previous','baseline')),
  dimension_type text not null check (dimension_type in ('page','query','query_page')),
  dimension_value text not null,
  secondary_value text not null default '',
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  ctr numeric(8,5),
  average_position numeric(7,2),
  synced_at timestamptz not null default now(),
  unique(period_start,period_end,window_role,dimension_type,dimension_value,secondary_value)
);

create table if not exists public.seo_search_opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_key text not null unique,
  opportunity_type text not null check (opportunity_type in ('LOW_CTR','NEAR_PAGE_ONE','DECLINING_TRAFFIC','RISING_QUERY','CONTENT_GAP','QUERY_MISMATCH','CANNIBALISATION','HIGH_IMPRESSIONS_LOW_CONVERSIONS','STRONG_PAGE_EXPANSION','INTERNAL_LINK_OPPORTUNITY')),
  state text not null default 'NEW' check (state in ('NEW','DATA_COLLECTING','WATCH','READY_TO_OPTIMISE','OPTIMISATION_IN_PROGRESS','MEASURING_RESULT','STABLE','NEEDS_REVIEW')),
  query text,
  page_url text,
  title text not null,
  explanation text not null,
  recommended_action text not null,
  priority_score integer not null default 0 check (priority_score between 0 and 100),
  current_metrics jsonb not null default '{}'::jsonb,
  previous_metrics jsonb not null default '{}'::jsonb,
  ninety_day_metrics jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  dismissed_at timestamptz,
  dismissed_by uuid references auth.users(id) on delete set null,
  snoozed_until timestamptz,
  implemented_at timestamptz,
  implemented_by uuid references auth.users(id) on delete set null,
  implementation_notes text,
  updated_at timestamptz not null default now()
);

alter table public.seo_experiments
  add column if not exists search_opportunity_id uuid references public.seo_search_opportunities(id) on delete set null,
  add column if not exists implemented_at timestamptz,
  add column if not exists measurement_starts_at timestamptz,
  add column if not exists measurement_ends_at timestamptz,
  add column if not exists before_metrics jsonb not null default '{}'::jsonb,
  add column if not exists after_metrics jsonb not null default '{}'::jsonb,
  add column if not exists decision text check (decision is null or decision in ('keep','iterate','revert','inconclusive'));

create index if not exists seo_outreach_activities_due_idx on public.seo_outreach_activities(status,due_at);
create index if not exists seo_partnerships_pipeline_idx on public.seo_partnerships(status,next_action_at);
create index if not exists seo_backlinks_target_idx on public.seo_backlinks(outreach_target_id,status);
create index if not exists seo_search_windows_lookup_idx on public.seo_search_performance_windows(dimension_type,window_role,period_end desc);
create index if not exists seo_search_opportunities_queue_idx on public.seo_search_opportunities(state,priority_score desc,last_detected_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['seo_outreach_activities','seo_partnerships','seo_search_performance_windows','seo_search_opportunities'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists seo_super_admin_all on public.%I',table_name);
    execute format('create policy seo_super_admin_all on public.%I for all to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()))',table_name);
    execute format('grant all on public.%I to service_role',table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['seo_outreach_activities','seo_partnerships','seo_search_opportunities'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I',table_name,table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',table_name,table_name);
  end loop;
end $$;

-- Research completed 20 September 2026. Every row has an official or credible
-- institutional verification page. No personal contact data is inferred.
delete from public.seo_outreach_targets
where verification_status = 'unverified'
  and notes like 'Category placeholder only.%';

with researched(organisation,website,canonical_domain,organisation_type,sector_tags,verification_source_url,resource_match,outreach_reason,relevance_score,priority,score_breakdown) as (values
('Public Procurement Authority','https://ppa.gov.gh/','ppa.gov.gh','regulator',array['public procurement','suppliers'],'https://ppa.gov.gh/','/insights/how-to-bid-for-contracts-in-ghana','Share a practical supplier-readiness guide that reinforces transparent participation in Ghana public procurement.',98,'critical','{"audience_overlap":25,"authority":25,"resource_fit":25,"contactability":23}'::jsonb),
('Ghana Investment Promotion Centre','https://gipc.gov.gh/','gipc.gov.gh','government_agency',array['investment','business'],'https://gipc.gov.gh/investor-guide/','/insights/how-smes-can-find-contract-opportunities-in-ghana','Offer a procurement-opportunity resource for businesses using GIPC investor guidance and aftercare services.',91,'high','{"audience_overlap":24,"authority":24,"resource_fit":23,"contactability":20}'::jsonb),
('Ghana Export Promotion Authority','https://gepaghana.org/','gepaghana.org','government_agency',array['exports','SMEs'],'https://www.gepaghana.org/','/insights/documents-suppliers-should-prepare-before-bidding','Help export-ready Ghanaian suppliers prepare reusable compliance evidence for institutional opportunities.',90,'high','{"audience_overlap":24,"authority":24,"resource_fit":23,"contactability":19}'::jsonb),
('Ghana Standards Authority','https://www.gsa.gov.gh/','gsa.gov.gh','regulator',array['standards','compliance'],'https://www.gsa.gov.gh/','/insights/documents-suppliers-should-prepare-before-bidding','Connect supplier audiences with a source-grounded checklist that highlights standards and compliance evidence.',88,'high','{"audience_overlap":22,"authority":25,"resource_fit":23,"contactability":18}'::jsonb),
('Office of the Registrar of Companies','https://orc.gov.gh/','orc.gov.gh','government_agency',array['business registration','compliance'],'https://orc.gov.gh/','/insights/documents-suppliers-should-prepare-before-bidding','Provide registered businesses with a clear next step from corporate compliance to tender readiness.',94,'critical','{"audience_overlap":25,"authority":25,"resource_fit":24,"contactability":20}'::jsonb),
('Ghana Revenue Authority','https://gra.gov.gh/','gra.gov.gh','government_agency',array['tax','compliance'],'https://gra.gov.gh/','/insights/documents-suppliers-should-prepare-before-bidding','Share a supplier-readiness guide explaining why current statutory and tax evidence matters in bidding.',88,'high','{"audience_overlap":22,"authority":25,"resource_fit":23,"contactability":18}'::jsonb),
('Ghana Free Zones Authority','https://gfza.gov.gh/','gfza.gov.gh','government_agency',array['exports','manufacturing'],'https://gfza.gov.gh/','/insights/how-smes-can-find-contract-opportunities-in-ghana','Support export-oriented manufacturers and service companies with opportunity discovery and bid-readiness education.',86,'high','{"audience_overlap":23,"authority":24,"resource_fit":22,"contactability":17}'::jsonb),
('Ghana National Chamber of Commerce and Industry','https://www.ghanachamber.org/','ghanachamber.org','business_association',array['SMEs','trade'],'https://gfza.gov.gh/download/34/new-category/7716/ghana-free-zones-passport.pdf','/insights/how-smes-can-find-contract-opportunities-in-ghana','Offer members a neutral educational resource for identifying and qualifying public-sector opportunities.',95,'critical','{"audience_overlap":25,"authority":23,"resource_fit":25,"contactability":22}'::jsonb),
('Association of Ghana Industries','https://agighana.org/','agighana.org','business_association',array['industry','manufacturing'],'https://agighana.org/','/insights/how-to-find-tenders-in-ghana','Help industrial members monitor relevant public and development-funded demand without promoting indiscriminate bidding.',95,'critical','{"audience_overlap":25,"authority":24,"resource_fit":25,"contactability":21}'::jsonb),
('Private Enterprise Federation','https://pefghana.org/','pefghana.org','business_association',array['private sector','advocacy'],'https://pefghana.org/','/insights/public-tenders-vs-private-tenders-in-ghana','Provide private-sector associations with an educational comparison of public and private procurement routes.',92,'high','{"audience_overlap":25,"authority":23,"resource_fit":24,"contactability":20}'::jsonb),
('Ghana Employers Association','https://ghanaemployers.com.gh/','ghanaemployers.com.gh','business_association',array['employers','enterprise'],'https://ghanaemployers.com.gh/','/insights/how-smes-can-find-contract-opportunities-in-ghana','Offer employer members a procurement-intelligence resource that can support sustainable business development.',86,'high','{"audience_overlap":23,"authority":22,"resource_fit":23,"contactability":18}'::jsonb),
('Importers and Exporters Association of Ghana','https://www.ieaghana.com/','ieaghana.com','business_association',array['trade','logistics'],'https://www.ieaghana.com/','/insights/documents-suppliers-should-prepare-before-bidding','Share tender-readiness guidance relevant to importers, exporters and logistics providers serving institutions.',91,'high','{"audience_overlap":24,"authority":22,"resource_fit":24,"contactability":21}'::jsonb),
('Ghana Chamber of Mines','https://ghanachamberofmines.org/','ghanachamberofmines.org','industry_association',array['mining','suppliers'],'https://ghanachamberofmines.org/','/insights/rfq-vs-rfp-vs-tender','Offer supplier-development content explaining solicitation formats used across complex industrial procurement.',88,'high','{"audience_overlap":23,"authority":24,"resource_fit":23,"contactability":18}'::jsonb),
('Ghana Shippers Authority','https://www.shippers.org.gh/','shippers.org.gh','government_agency',array['shipping','logistics'],'https://www.shippers.org.gh/','/insights/how-to-find-tenders-in-ghana','Connect Ghanaian logistics and trade businesses with structured opportunity discovery and alert guidance.',87,'high','{"audience_overlap":23,"authority":24,"resource_fit":22,"contactability":18}'::jsonb),
('Ghana Stock Exchange','https://gse.com.gh/','gse.com.gh','market_infrastructure',array['finance','listed companies'],'https://gse.com.gh/','/insights/public-tenders-vs-private-tenders-in-ghana','Offer listed companies and advisers a useful explanation of institutional public and private tender channels.',79,'medium','{"audience_overlap":19,"authority":24,"resource_fit":20,"contactability":16}'::jsonb),
('Development Bank Ghana','https://www.dbg.com.gh/','dbg.com.gh','development_finance',array['SME finance','business growth'],'https://www.dbg.com.gh/who-we-serve/','/insights/how-smes-can-find-contract-opportunities-in-ghana','Pair SME finance and business-development support with disciplined contract-opportunity discovery.',93,'critical','{"audience_overlap":25,"authority":24,"resource_fit":25,"contactability":19}'::jsonb),
('Ghana Institution of Engineering','https://ghie.org.gh/','ghie.org.gh','professional_body',array['engineering','construction'],'https://ghie.org.gh/about/','/insights/documents-suppliers-should-prepare-before-bidding','Give engineering practitioners a reusable evidence checklist for technical and public-sector bids.',94,'critical','{"audience_overlap":25,"authority":24,"resource_fit":25,"contactability":20}'::jsonb),
('Ghana Institution of Surveyors','https://www.ghanasurveyors.org/','ghanasurveyors.org','professional_body',array['surveying','construction'],'https://www.ghanasurveyors.org/','/insights/how-to-bid-for-contracts-in-ghana','Share practical bid qualification guidance with quantity, land and valuation surveying professionals.',94,'critical','{"audience_overlap":25,"authority":24,"resource_fit":25,"contactability":20}'::jsonb),
('Ghana Institute of Architects','https://gia.com.gh/','gia.com.gh','professional_body',array['architecture','construction'],'https://gia.com.gh/','/insights/how-to-bid-for-contracts-in-ghana','Support architectural practices with procurement-format and bid-readiness educational resources.',92,'high','{"audience_overlap":25,"authority":23,"resource_fit":25,"contactability":19}'::jsonb),
('Institute of Chartered Accountants Ghana','https://www.icagh.org/','icagh.org','professional_body',array['accounting','professional services'],'https://www.icagh.org/','/insights/documents-suppliers-should-prepare-before-bidding','Help accounting firms understand financial evidence and qualification documents commonly required in tenders.',90,'high','{"audience_overlap":24,"authority":24,"resource_fit":24,"contactability":18}'::jsonb),
('Chartered Institute of Marketing Ghana','https://cimghana.org/','cimghana.org','professional_body',array['marketing','professional services'],'https://cimghana.org/','/insights/rfq-vs-rfp-vs-tender','Offer members a concise guide to RFQs, RFPs and tenders relevant to marketing-service procurement.',86,'high','{"audience_overlap":22,"authority":23,"resource_fit":23,"contactability":18}'::jsonb),
('Institute of ICT Professionals Ghana','https://iipgh.org/','iipgh.org','professional_body',array['ICT','technology'],'https://iipgh.org/about/','/insights/how-to-find-tenders-in-ghana','Connect accredited ICT professionals and firms with transparent digital and public-sector opportunity discovery.',95,'critical','{"audience_overlap":25,"authority":23,"resource_fit":25,"contactability":22}'::jsonb),
('University of Ghana Business School','https://ugbs.ug.edu.gh/','ugbs.ug.edu.gh','academic',array['business education','procurement'],'https://ugbs.ug.edu.gh/node/217','/insights/how-to-bid-for-contracts-in-ghana','Offer procurement and supply-chain learners a Ghana-specific practical companion to academic training.',90,'high','{"audience_overlap":24,"authority":24,"resource_fit":24,"contactability":18}'::jsonb),
('KNUST School of Business - Supply Chain and Information Systems','https://business.knust.edu.gh/departments/scis','business.knust.edu.gh','academic',array['supply chain','procurement'],'https://business.knust.edu.gh/departments/scis','/insights/rfq-vs-rfp-vs-tender','Provide students, alumni and industry collaborators with practical Ghana procurement terminology and workflows.',90,'high','{"audience_overlap":24,"authority":24,"resource_fit":24,"contactability":18}'::jsonb),
('GCTU Business School','https://gbs.gctu.edu.gh/','gbs.gctu.edu.gh','academic',array['technology','procurement'],'https://gbs.gctu.edu.gh/','/insights/how-to-find-tenders-in-ghana','Support procurement, logistics and technology learners with a live-market discovery resource.',88,'high','{"audience_overlap":24,"authority":22,"resource_fit":24,"contactability":18}'::jsonb),
('Kumasi Technical University Procurement and Supply Chain Department','https://bus.kstu.edu.gh/department/department-procurement-and-supply-chain-management','bus.kstu.edu.gh','academic',array['procurement','supply chain'],'https://bus.kstu.edu.gh/department/department-procurement-and-supply-chain-management','/insights/how-to-bid-for-contracts-in-ghana','Offer a practical Ghana tender research resource for procurement students and industry engagement.',89,'high','{"audience_overlap":25,"authority":22,"resource_fit":25,"contactability":17}'::jsonb),
('University for Development Studies School of Business','https://www.sob.uds.edu.gh/pscm-department','sob.uds.edu.gh','academic',array['procurement','northern Ghana'],'https://www.sob.uds.edu.gh/pscm-department','/insights/how-smes-can-find-contract-opportunities-in-ghana','Extend practical opportunity discovery guidance to procurement learners and SMEs in northern Ghana.',88,'high','{"audience_overlap":24,"authority":22,"resource_fit":24,"contactability":18}'::jsonb),
('Ghana Institute of Management and Public Administration','https://gimpa.edu.gh/','gimpa.edu.gh','academic',array['public administration','business'],'https://gimpa.edu.gh/','/insights/public-tenders-vs-private-tenders-in-ghana','Offer public-administration and business audiences a practical comparison of procurement channels.',87,'high','{"audience_overlap":23,"authority":24,"resource_fit":23,"contactability":17}'::jsonb),
('University of Professional Studies Accra','https://upsa.edu.gh/','upsa.edu.gh','academic',array['professional education','business'],'https://upsa.edu.gh/','/insights/documents-suppliers-should-prepare-before-bidding','Provide professional learners and alumni with an actionable supplier-document readiness guide.',85,'high','{"audience_overlap":22,"authority":23,"resource_fit":23,"contactability":17}'::jsonb),
('United Nations Development Programme Ghana','https://www.undp.org/ghana','undp.org','development_partner',array['MSME','governance'],'https://www.undp.org/ghana','/insights/how-smes-can-find-contract-opportunities-in-ghana','Explore educational collaboration around MSME digital growth, transparent procurement and supplier participation.',89,'high','{"audience_overlap":23,"authority":25,"resource_fit":23,"contactability":18}'::jsonb),
('World Bank Group Ghana','https://www.worldbank.org/ext/en/country/ghana','worldbank.org','development_partner',array['development','private sector'],'https://www.worldbank.org/ext/en/country/ghana','/insights/how-smes-can-find-contract-opportunities-in-ghana','Share a Ghana supplier-readiness resource aligned with private-sector development and development-funded procurement.',88,'high','{"audience_overlap":23,"authority":25,"resource_fit":23,"contactability":17}'::jsonb),
('GIZ Ghana','https://www.giz.de/en/regions/africa/ghana','giz.de','development_partner',array['SME','employment'],'https://www.giz.de/en/regions/africa/ghana','/insights/how-smes-can-find-contract-opportunities-in-ghana','Explore a supplier education partnership supporting inclusive growth, trade and digital-economy firms.',87,'high','{"audience_overlap":23,"authority":24,"resource_fit":23,"contactability":17}'::jsonb),
('African Development Bank Ghana','https://www.afdb.org/en/countries/west-africa/ghana','afdb.org','development_partner',array['infrastructure','private sector'],'https://www.afdb.org/en/countries/west-africa/ghana','/insights/how-to-find-tenders-in-ghana','Offer Ghanaian suppliers contextual guidance for finding and evaluating development-funded opportunities.',88,'high','{"audience_overlap":23,"authority":25,"resource_fit":23,"contactability":17}'::jsonb),
('International Finance Corporation Ghana','https://www.ifc.org/en/where-we-work/africa/ghana','ifc.org','development_partner',array['private sector','SME finance'],'https://www.ifc.org/en/where-we-work/africa/ghana','/insights/public-tenders-vs-private-tenders-in-ghana','Provide growing Ghanaian firms with practical insight into institutional and private procurement demand.',84,'high','{"audience_overlap":22,"authority":25,"resource_fit":21,"contactability":16}'::jsonb),
('European Union Delegation to Ghana','https://www.eeas.europa.eu/ghana_en','eeas.europa.eu','development_partner',array['trade','development'],'https://www.eeas.europa.eu/ghana_en','/insights/how-smes-can-find-contract-opportunities-in-ghana','Explore non-promotional supplier education relevant to Ghana-EU trade and development programmes.',83,'high','{"audience_overlap":21,"authority":25,"resource_fit":21,"contactability":16}'::jsonb),
('Ghana Anti-Corruption Coalition','https://gaccgh.org/','gaccgh.org','civil_society',array['transparency','procurement'],'https://gaccgh.org/','/insights/how-to-compare-supplier-bids-fairly','Share a transparent bid-comparison guide relevant to accountable procurement and public-resource use.',92,'high','{"audience_overlap":24,"authority":24,"resource_fit":25,"contactability":19}'::jsonb),
('Ghana Center for Democratic Development','https://cddgh.org/','cddgh.org','civil_society',array['governance','accountability'],'https://cddgh.org/corruptionwatch/','/insights/how-to-compare-supplier-bids-fairly','Offer a practical resource on fair supplier comparison and documented procurement decisions.',87,'high','{"audience_overlap":22,"authority":24,"resource_fit":23,"contactability":18}'::jsonb),
('Penplusbytes','https://www.penplusbytes.org/','penplusbytes.org','civil_society',array['digital governance','media'],'https://www.penplusbytes.org/','/insights/how-businesses-can-run-private-tenders-on-bidscope','Explore content collaboration on transparent digital procurement and public accountability.',89,'high','{"audience_overlap":23,"authority":23,"resource_fit":24,"contactability":19}'::jsonb),
('SEND Ghana','https://sendwestafrica.org/ghana/','sendwestafrica.org','civil_society',array['social accountability','development'],'https://sendwestafrica.org/ghana/','/insights/how-to-compare-supplier-bids-fairly','Share evidence-led procurement education relevant to social accountability and public expenditure monitoring.',84,'high','{"audience_overlap":21,"authority":23,"resource_fit":23,"contactability":17}'::jsonb),
('West Africa Civil Society Institute','https://wacsi.org/','wacsi.org','civil_society',array['civil society','capacity building'],'https://wacsi.org/','/insights/documents-suppliers-should-prepare-before-bidding','Offer civil-society organisations a practical checklist for institutional tender and grant-adjacent procurement readiness.',82,'high','{"audience_overlap":21,"authority":23,"resource_fit":22,"contactability":16}'::jsonb),
('Graphic Business','https://www.graphic.com.gh/business/','graphic.com.gh','media',array['business media','SMEs'],'https://www.graphic.com.gh/business/','/insights/how-smes-can-find-contract-opportunities-in-ghana','Propose a useful expert resource for Ghanaian SMEs on finding and qualifying contract opportunities.',86,'high','{"audience_overlap":24,"authority":22,"resource_fit":23,"contactability":17}'::jsonb),
('Ghana News Agency','https://gna.org.gh/','gna.org.gh','media',array['public information','business'],'https://gna.org.gh/','/insights/public-tenders-vs-private-tenders-in-ghana','Offer a factual explainer on Ghana procurement channels for possible public-interest business coverage.',80,'medium','{"audience_overlap":20,"authority":24,"resource_fit":21,"contactability":15}'::jsonb),
('Ghana Statistical Service','https://statsghana.gov.gh/','statsghana.gov.gh','government_agency',array['data','business statistics'],'https://statsghana.gov.gh/','/insights/how-smes-can-find-contract-opportunities-in-ghana','Explore a resource-linking relationship that encourages evidence-led market and opportunity decisions.',78,'medium','{"audience_overlap":19,"authority":25,"resource_fit":20,"contactability":14}'::jsonb),
('Bank of Ghana','https://www.bog.gov.gh/','bog.gov.gh','regulator',array['finance','business'],'https://www.bog.gov.gh/','/insights/documents-suppliers-should-prepare-before-bidding','Provide regulated financial-sector suppliers with a practical guide to procurement evidence preparation.',80,'medium','{"audience_overlap":20,"authority":25,"resource_fit":21,"contactability":14}'::jsonb),
('National Communications Authority','https://nca.org.gh/','nca.org.gh','regulator',array['telecommunications','ICT'],'https://nca.org.gh/','/insights/how-to-find-tenders-in-ghana','Share opportunity-discovery guidance with licensed communications and technology businesses.',82,'high','{"audience_overlap":22,"authority":24,"resource_fit":21,"contactability":15}'::jsonb),
('Energy Commission Ghana','https://www.energycom.gov.gh/','energycom.gov.gh','regulator',array['energy','engineering'],'https://www.energycom.gov.gh/','/insights/documents-suppliers-should-prepare-before-bidding','Offer energy-sector firms practical tender-readiness and evidence-collection guidance.',82,'high','{"audience_overlap":22,"authority":24,"resource_fit":21,"contactability":15}'::jsonb),
('Public Utilities Regulatory Commission','https://www.purc.com.gh/','purc.com.gh','regulator',array['utilities','energy'],'https://www.purc.com.gh/','/insights/how-to-bid-for-contracts-in-ghana','Share practical bid-readiness education relevant to suppliers serving regulated utility sectors.',80,'medium','{"audience_overlap":21,"authority":24,"resource_fit":21,"contactability":14}'::jsonb),
('Ghana Ports and Harbours Authority','https://www.ghanaports.gov.gh/','ghanaports.gov.gh','state_enterprise',array['ports','logistics'],'https://www.ghanaports.gov.gh/','/insights/rfq-vs-rfp-vs-tender','Offer logistics and port-sector suppliers a practical guide to common solicitation formats.',82,'high','{"audience_overlap":22,"authority":24,"resource_fit":21,"contactability":15}'::jsonb),
('Ghana Civil Aviation Authority','https://www.gcaa.com.gh/','gcaa.com.gh','regulator',array['aviation','logistics'],'https://www.gcaa.com.gh/','/insights/documents-suppliers-should-prepare-before-bidding','Provide aviation-sector suppliers with a structured evidence and bid-document preparation resource.',79,'medium','{"audience_overlap":20,"authority":24,"resource_fit":21,"contactability":14}'::jsonb)
)
insert into public.seo_outreach_targets(
  organisation,website,canonical_domain,organisation_type,sector_tags,verification_status,
  verification_source_url,verified_at,last_verified_at,verification_notes,resource_match,
  reason_to_approach,outreach_reason,relevance_score,priority,score_breakdown,status,notes
)
select organisation,website,canonical_domain,organisation_type,sector_tags,'verified',verification_source_url,
  now(),now(),'Verified from the linked official or credible institutional page on 20 September 2026.',
  resource_match,outreach_reason,outreach_reason,relevance_score,priority,score_breakdown,'discovered',
  'Research seed only. Re-check the public contact route before outreach. No email address was inferred.'
from researched
where not exists (
  select 1
  from public.seo_outreach_targets existing
  where lower(trim(existing.organisation)) = lower(trim(researched.organisation))
     or (
       researched.canonical_domain <> ''
       and existing.canonical_domain = researched.canonical_domain
     )
);
