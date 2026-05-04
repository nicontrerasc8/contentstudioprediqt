-- Run this after the base schema you pasted.
-- It adds auth profiles, real roles, A/B approvals, local AI traces and RLS policies.

create extension if not exists pgcrypto;
create extension if not exists vector;

do $$
begin
  create type public.app_role as enum ('creador', 'aprobador_a', 'aprobador_b');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.approval_decision as enum ('pendiente', 'aprobado', 'rechazado');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.governance_item_type as enum ('content', 'image_audit');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.app_role not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.brands
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.content_generations
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists compliance_status text not null default 'pendiente'
    check (compliance_status in ('pendiente', 'check', 'rechazado')),
  add column if not exists compliance_issues jsonb not null default '[]'::jsonb,
  add column if not exists approval_status text not null default 'pendiente'
    check (approval_status in ('pendiente', 'aprobado', 'rechazado')),
  add column if not exists reviewed_by text,
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamp with time zone;

alter table public.image_audits
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_status text not null default 'pendiente'
    check (approval_status in ('pendiente', 'aprobado', 'rechazado')),
  add column if not exists reviewed_by text,
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamp with time zone;

create table if not exists public.approval_reviews (
  id uuid primary key default gen_random_uuid(),
  item_type public.governance_item_type not null,
  item_id uuid not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_role public.app_role not null check (
    reviewer_role in ('aprobador_a'::public.app_role, 'aprobador_b'::public.app_role)
  ),
  decision public.approval_decision not null,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (item_type, item_id, reviewer_role)
);

create table if not exists public.ai_traces (
  id uuid primary key default gen_random_uuid(),
  operation text not null check (
    operation in (
      'brand_manual',
      'creative_generation',
      'creative_compliance',
      'image_audit'
    )
  ),
  brand_id uuid references public.brands(id) on delete set null,
  item_type text,
  item_id uuid,
  model text not null,
  prompt text not null,
  rag_context text,
  input jsonb not null default '{}'::jsonb,
  output text,
  error text,
  duration_ms int not null check (duration_ms >= 0),
  langfuse_enabled boolean not null default false,
  langfuse_trace_id text,
  langfuse_observation_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists profiles_role_idx
  on public.profiles(role);

create index if not exists brands_created_by_idx
  on public.brands(created_by);

create index if not exists content_generations_created_by_idx
  on public.content_generations(created_by);

create index if not exists content_generations_approval_status_idx
  on public.content_generations(approval_status);

create index if not exists image_audits_created_by_idx
  on public.image_audits(created_by);

create index if not exists image_audits_approval_status_idx
  on public.image_audits(approval_status);

create index if not exists approval_reviews_item_idx
  on public.approval_reviews(item_type, item_id);

create index if not exists approval_reviews_reviewer_idx
  on public.approval_reviews(reviewer_id);

create index if not exists ai_traces_operation_idx
  on public.ai_traces(operation);

create index if not exists ai_traces_brand_id_idx
  on public.ai_traces(brand_id);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid();
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists approval_reviews_touch_updated_at on public.approval_reviews;
create trigger approval_reviews_touch_updated_at
before update on public.approval_reviews
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.brand_embeddings enable row level security;
alter table public.content_generations enable row level security;
alter table public.image_audits enable row level security;
alter table public.approval_reviews enable row level security;
alter table public.ai_traces enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists brands_select_authenticated on public.brands;
create policy brands_select_authenticated
  on public.brands for select
  to authenticated
  using (true);

drop policy if exists brands_insert_creator on public.brands;
drop policy if exists brands_insert_authenticated on public.brands;
create policy brands_insert_authenticated
  on public.brands for insert
  to authenticated
  with check (
    created_by = auth.uid()
  );

drop policy if exists brands_update_authenticated on public.brands;
create policy brands_update_authenticated
  on public.brands for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists brands_delete_authenticated on public.brands;
create policy brands_delete_authenticated
  on public.brands for delete
  to authenticated
  using (true);

drop policy if exists brand_embeddings_select_authenticated on public.brand_embeddings;
create policy brand_embeddings_select_authenticated
  on public.brand_embeddings for select
  to authenticated
  using (true);

drop policy if exists brand_embeddings_insert_creator on public.brand_embeddings;
drop policy if exists brand_embeddings_insert_authenticated on public.brand_embeddings;
create policy brand_embeddings_insert_authenticated
  on public.brand_embeddings for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.brands
      where brands.id = brand_embeddings.brand_id
    )
  );

drop policy if exists brand_embeddings_delete_authenticated on public.brand_embeddings;
create policy brand_embeddings_delete_authenticated
  on public.brand_embeddings for delete
  to authenticated
  using (true);

drop policy if exists content_generations_select_authenticated on public.content_generations;
create policy content_generations_select_authenticated
  on public.content_generations for select
  to authenticated
  using (true);

drop policy if exists content_generations_insert_creator on public.content_generations;
create policy content_generations_insert_creator
  on public.content_generations for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.current_app_role() = 'creador'::public.app_role
  );

drop policy if exists image_audits_select_authenticated on public.image_audits;
create policy image_audits_select_authenticated
  on public.image_audits for select
  to authenticated
  using (true);

drop policy if exists image_audits_insert_creator on public.image_audits;
create policy image_audits_insert_creator
  on public.image_audits for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.current_app_role() = 'creador'::public.app_role
  );

drop policy if exists approval_reviews_select_authenticated on public.approval_reviews;
create policy approval_reviews_select_authenticated
  on public.approval_reviews for select
  to authenticated
  using (true);

drop policy if exists approval_reviews_insert_own_role on public.approval_reviews;
create policy approval_reviews_insert_own_role
  on public.approval_reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and reviewer_role = public.current_app_role()
    and reviewer_role in ('aprobador_a'::public.app_role, 'aprobador_b'::public.app_role)
  );

drop policy if exists approval_reviews_update_own_role on public.approval_reviews;
create policy approval_reviews_update_own_role
  on public.approval_reviews for update
  to authenticated
  using (
    reviewer_id = auth.uid()
    and reviewer_role = public.current_app_role()
  )
  with check (
    reviewer_id = auth.uid()
    and reviewer_role = public.current_app_role()
    and reviewer_role in ('aprobador_a'::public.app_role, 'aprobador_b'::public.app_role)
  );
