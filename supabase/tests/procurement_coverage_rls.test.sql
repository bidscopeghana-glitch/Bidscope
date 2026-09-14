begin;
select plan(9);

select ok(not has_table_privilege('anon','public.procurement_raw_records','select,insert,update,delete'),'anon cannot access raw ingestion evidence');
select ok(not has_table_privilege('anon','public.procurement_source_alerts','select,insert,update,delete'),'anon cannot access source alerts');
select ok(not has_table_privilege('anon','public.procurement_source_research','select,insert,update,delete'),'anon cannot access source research');
select ok(not has_table_privilege('authenticated','public.procurement_raw_records','insert,update,delete'),'authenticated cannot mutate raw records');
select ok(not has_table_privilege('authenticated','public.procurement_source_alerts','insert,update,delete'),'authenticated cannot mutate source alerts');
select ok(not has_table_privilege('authenticated','public.procurement_source_research','insert,update,delete'),'authenticated cannot mutate source research');

set local role authenticated;
select is_empty($$select * from public.procurement_raw_records$$,'non-admin sees no raw records');
select is_empty($$select * from public.procurement_source_alerts$$,'non-admin sees no source alerts');
select is_empty($$select * from public.procurement_source_research$$,'non-admin sees no source research');

select * from finish();
rollback;
