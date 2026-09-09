-- Biology Second Brain: Supabase schema + role based access control
-- 실행 위치: Supabase Dashboard > SQL Editor > New query > 전체 복붙 후 Run
-- 주의: service_role key는 절대 GitHub에 올리지 마세요. anon key만 프론트엔드에 사용합니다.

-- ============================
-- 1. common helper
-- ============================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================
-- 2. profiles: 사용자 role 저장
-- ============================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'pending' check (role in ('owner','member','viewer','pending','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists role text not null default 'pending';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner','member','viewer','pending','blocked'));
alter table public.profiles enable row level security;

-- RLS policy 안에서 profiles를 안전하게 조회하기 위한 함수
create or replace function public.current_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- 기존 policy/trigger가 있으면 제거 후 재생성
DROP POLICY IF EXISTS "profiles select self or owner" ON public.profiles;
DROP POLICY IF EXISTS "profiles owner update" ON public.profiles;
DROP POLICY IF EXISTS "profiles owner delete" ON public.profiles;
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;

create policy "profiles select self or owner" on public.profiles
  for select using (auth.uid() = id or public.current_role() = 'owner');

create policy "profiles owner update" on public.profiles
  for update using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

create policy "profiles owner delete" on public.profiles
  for delete using (public.current_role() = 'owner');

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 회원가입/초대 수락 시 pending profile 자동 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'pending')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================
-- 3. papers: 공용/멤버/비공개 논문
-- ============================
create table if not exists public.papers (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  added_at bigint not null,
  read_cycle text default '',
  visibility text not null default 'members' check (visibility in ('public','members','private')),
  review_status text not null default 'pending_review' check (review_status in ('approved','pending_review','rejected')),
  disease jsonb not null default '[]'::jsonb,
  disease_notes jsonb not null default '{}'::jsonb,
  genes jsonb not null default '[]'::jsonb,
  cell_types jsonb not null default '[]'::jsonb,
  tissues jsonb not null default '[]'::jsonb,
  datasets jsonb not null default '[]'::jsonb,
  marker_genes jsonb not null default '[]'::jsonb,
  title text not null,
  journal text default '',
  year int,
  authors text default '',
  doi_or_url text default '',
  summary jsonb not null default '[]'::jsonb,
  new_knowledge jsonb not null default '[]'::jsonb,
  pathway jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.papers add column if not exists updated_at timestamptz not null default now();
alter table public.papers add column if not exists datasets jsonb not null default '[]'::jsonb;
alter table public.papers add column if not exists marker_genes jsonb not null default '[]'::jsonb;
alter table public.papers add column if not exists visibility text not null default 'members';
alter table public.papers add column if not exists review_status text not null default 'pending_review';
alter table public.papers drop constraint if exists papers_visibility_check;
alter table public.papers drop constraint if exists papers_review_status_check;
alter table public.papers add constraint papers_visibility_check check (visibility in ('public','members','private'));
alter table public.papers add constraint papers_review_status_check check (review_status in ('approved','pending_review','rejected'));
alter table public.papers enable row level security;

DROP POLICY IF EXISTS "papers select by role" ON public.papers;
DROP POLICY IF EXISTS "papers insert owner or member" ON public.papers;
DROP POLICY IF EXISTS "papers update owner or own member" ON public.papers;
DROP POLICY IF EXISTS "papers delete owner only" ON public.papers;
DROP TRIGGER IF EXISTS papers_protect_fields ON public.papers;
DROP TRIGGER IF EXISTS papers_set_updated_at ON public.papers;

-- Member는 owner_id, visibility, review_status를 직접 바꾸지 못하게 보호
create or replace function public.protect_paper_fields()
returns trigger as $$
begin
  if public.current_role() <> 'owner' then
    new.owner_id := old.owner_id;
    new.visibility := old.visibility;
    new.review_status := old.review_status;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger papers_protect_fields
  before update on public.papers
  for each row execute function public.protect_paper_fields();

create trigger papers_set_updated_at
  before update on public.papers
  for each row execute function public.set_updated_at();

create policy "papers select by role" on public.papers
  for select using (
    public.current_role() = 'owner'
    or owner_id = auth.uid()
    or (public.current_role() = 'member' and visibility in ('public','members') and review_status = 'approved')
    or (public.current_role() = 'viewer' and visibility = 'public' and review_status = 'approved')
  );

create policy "papers insert owner or member" on public.papers
  for insert with check (
    owner_id = auth.uid()
    and (
      public.current_role() = 'owner'
      or (public.current_role() = 'member' and visibility = 'members' and review_status = 'pending_review')
    )
  );

create policy "papers update owner or own member" on public.papers
  for update using (
    public.current_role() = 'owner'
    or (public.current_role() = 'member' and owner_id = auth.uid())
  )
  with check (
    public.current_role() = 'owner'
    or (public.current_role() = 'member' and owner_id = auth.uid())
  );

create policy "papers delete owner only" on public.papers
  for delete using (public.current_role() = 'owner');

-- ============================
-- 4. knowledge: owner 전용 개인 지식/메모
-- ============================
create table if not exists public.knowledge (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  added_at bigint not null,
  read_cycle text default '',
  category text default 'Note',
  title text not null,
  related_diseases jsonb not null default '[]'::jsonb,
  related_genes jsonb not null default '[]'::jsonb,
  related_cell_types jsonb not null default '[]'::jsonb,
  related_tissues jsonb not null default '[]'::jsonb,
  knowledge jsonb not null default '[]'::jsonb,
  source text default '',
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge add column if not exists updated_at timestamptz not null default now();
alter table public.knowledge add column if not exists created_at timestamptz not null default now();
alter table public.knowledge enable row level security;

DROP POLICY IF EXISTS "knowledge owner only" ON public.knowledge;
DROP TRIGGER IF EXISTS knowledge_set_updated_at ON public.knowledge;

create policy "knowledge owner only" on public.knowledge
  for all using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

create trigger knowledge_set_updated_at
  before update on public.knowledge
  for each row execute function public.set_updated_at();

-- ============================
-- 4b. entity_notes: Disease/Gene/Cell Type/Tissue에 다는 메모 (공개/개인 선택)
-- ============================
create table if not exists public.entity_notes (
  id text primary key,
  entity_type text not null check (entity_type in ('disease','gene','cell_type','tissue')),
  entity_name text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entity_notes_lookup on public.entity_notes (entity_type, entity_name);
alter table public.entity_notes enable row level security;

DROP POLICY IF EXISTS "entity_notes select public or own or owner" ON public.entity_notes;
DROP POLICY IF EXISTS "entity_notes insert own" ON public.entity_notes;
DROP POLICY IF EXISTS "entity_notes update own or owner" ON public.entity_notes;
DROP POLICY IF EXISTS "entity_notes delete own or owner" ON public.entity_notes;
DROP TRIGGER IF EXISTS entity_notes_set_updated_at ON public.entity_notes;

create policy "entity_notes select public or own or owner" on public.entity_notes
  for select using (
    visibility = 'public' or author_id = auth.uid() or public.current_role() = 'owner'
  );

create policy "entity_notes insert own" on public.entity_notes
  for insert with check (
    author_id = auth.uid() and public.current_role() in ('owner','member','viewer')
  );

create policy "entity_notes update own or owner" on public.entity_notes
  for update using (author_id = auth.uid() or public.current_role() = 'owner')
  with check (author_id = auth.uid() or public.current_role() = 'owner');

create policy "entity_notes delete own or owner" on public.entity_notes
  for delete using (author_id = auth.uid() or public.current_role() = 'owner');

create trigger entity_notes_set_updated_at
  before update on public.entity_notes
  for each row execute function public.set_updated_at();

-- ============================
-- 5. API grants
-- ============================
grant usage on schema public to authenticated;
grant select, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.papers to authenticated;
grant select, insert, update, delete on public.knowledge to authenticated;
grant select, insert, update, delete on public.entity_notes to authenticated;
grant execute on function public.current_role() to authenticated;

-- ============================
-- 6. 첫 owner 지정 방법
-- ============================
-- 1) 웹사이트에서 본인 이메일로 회원가입/로그인해서 profiles row를 만든다.
-- 2) Supabase SQL Editor에서 아래 한 줄의 이메일을 본인 이메일로 바꿔 실행한다.
-- update public.profiles set role = 'owner' where email = 'sihyeon0422@yonsei.ac.kr';
--
-- 이후 owner는 Library > User Access에서 member/viewer/blocked를 바꿀 수 있다.
