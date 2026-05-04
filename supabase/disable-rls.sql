-- Disables RLS for the application tables and leaves Supabase Storage
-- permissive for authenticated users.
--
-- Run this in Supabase SQL Editor if you do not want RLS blocking app writes.

alter table public.profiles disable row level security;
alter table public.brands disable row level security;
alter table public.brand_embeddings disable row level security;
alter table public.content_generations disable row level security;
alter table public.image_audits disable row level security;
alter table public.approval_reviews disable row level security;
alter table public.ai_traces disable row level security;

drop policy if exists audit_files_select_authenticated on storage.objects;
create policy audit_files_select_authenticated
  on storage.objects for select
  to authenticated
  using (bucket_id = 'brand-audit-files');

drop policy if exists audit_files_insert_authenticated on storage.objects;
create policy audit_files_insert_authenticated
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'brand-audit-files');

drop policy if exists audit_files_insert_own_folder on storage.objects;

drop policy if exists audit_files_update_authenticated on storage.objects;
create policy audit_files_update_authenticated
  on storage.objects for update
  to authenticated
  using (bucket_id = 'brand-audit-files')
  with check (bucket_id = 'brand-audit-files');

drop policy if exists audit_files_delete_authenticated on storage.objects;
create policy audit_files_delete_authenticated
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'brand-audit-files');
