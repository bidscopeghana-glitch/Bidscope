-- Private supplier business documents; no direct client storage policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('supplier-documents-private','supplier-documents-private',false,4194304,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create index if not exists supplier_documents_org_created_idx on public.supplier_documents(organization_id,created_at desc);
