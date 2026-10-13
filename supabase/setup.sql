-- =============================================================
-- 미대갈래 — 데이터베이스 스키마 v0.1 (Supabase / PostgreSQL)
-- 스프린트 2 · 2026-10
--  * 입시 데이터(편집부 입력): universities → programs → admissions → (results, exam_themes)
--  * 콘텐츠: pass_cases(합격자 사례), reviews(교수 심사평)
--  * 사용자 데이터: profiles, awards, artworks, analyses, targets
--  * 엑셀 입력 양식(midae_data_template.xlsx)의 시트·열 이름과 1:1로 대응
-- =============================================================

-- ---------- 코드(열거형) ----------
create type region_t       as enum ('서울','경기','인천','강원','대전','세종','충북','충남','광주','전북','전남','대구','경북','부산','울산','경남','제주');
create type major_t        as enum ('시각디자인','산업디자인','회화','조소','공예','애니메이션','패션디자인','실내·공간디자인','영상·미디어','미술교육','기타');
create type round_t        as enum ('수시','정시');
create type practical_t    as enum ('실기','비실기');
create type gpa_system_t   as enum ('5등급','9등급');
create type student_t      as enum ('고3','재수','N수','검정고시','기타');

-- ---------- 입시 데이터 ----------
create table universities (
  id            text primary key,            -- 예: U001
  name          text not null,               -- 대학명
  campus        text,                        -- 캠퍼스 (본교/분교)
  region        region_t not null,
  kind          text default '4년제',         -- 4년제 / 전문대
  website       text,                        -- 입학처 주소
  updated_at    timestamptz default now()
);

create table programs (                      -- 학과(모집단위)
  id            text primary key,            -- 예: P001
  university_id text not null references universities(id) on delete cascade,
  name          text not null,               -- 모집단위명 (예: 시각디자인과)
  major         major_t not null,            -- 전공 분류
  note          text,
  updated_at    timestamptz default now()
);

create table admissions (                    -- 전형 (학년도별)
  id            text primary key,            -- 예: A001
  program_id    text not null references programs(id) on delete cascade,
  year          int  not null,               -- 학년도 (예: 2027)
  round         round_t not null,            -- 수시/정시
  track_name    text not null,               -- 전형명 (예: 실기우수자전형)
  practical     practical_t not null,
  quota         int,                         -- 모집인원
  w_practical   numeric(5,2) default 0,      -- 반영비율 % (합계 100)
  w_gpa         numeric(5,2) default 0,
  w_csat        numeric(5,2) default 0,
  w_other       numeric(5,2) default 0,      -- 면접·서류 등
  other_desc    text,
  exam_subject  text,                        -- 실기 종목 (기초디자인, 사고의전환 …)
  exam_minutes  int,                         -- 실기 시간(분)
  paper         text,                        -- 용지 (예: 3절 켄트지)
  materials     text,                        -- 재료
  source        text,                        -- 출처 (모집요강·「미대입시」 호수)
  updated_at    timestamptz default now(),
  constraint weights_sum check (w_practical + w_gpa + w_csat + w_other = 100)
);

create table results (                       -- 전년도 입시결과
  admission_id  text primary key references admissions(id) on delete cascade,
  applicants    int,                         -- 지원자 수
  competition   numeric(6,2),                -- 경쟁률 (n : 1 의 n)
  gpa_avg       numeric(4,2),                -- 합격자 내신 평균 등급
  gpa_cut70     numeric(4,2),                -- 70% 컷 등급
  gpa_system    gpa_system_t default '9등급',
  csat_pct_avg  numeric(5,2),                -- 합격자 수능 백분위 평균
  score_mean    numeric(5,2),                -- 앱 환산점수 기준 합격자 평균 (매칭 엔진용)
  score_sd      numeric(5,2),                -- 표준편차
  waitlist_rank int,                         -- 충원 순위
  source        text
);

create table exam_themes (                   -- 실기 기출 주제
  id            bigserial primary key,
  admission_id  text not null references admissions(id) on delete cascade,
  year          int not null,
  theme         text not null,
  given_objects text                         -- 제시 사물
);

-- ---------- 콘텐츠 ----------
create table pass_cases (                    -- 합격자 사례 (수기)
  id             text primary key,           -- 예: C001
  program_id     text not null references programs(id),
  year           int not null,               -- 합격 학년도
  student_type   student_t,
  gpa            numeric(4,2),
  gpa_system     gpa_system_t,
  csat_pct       numeric(5,2),
  academy_months int,                        -- 미술학원 기간(개월)
  academy_start  text,                       -- 시작 시기 (예: 고1 겨울)
  awards         text,
  story          text,                       -- 수기 요약 / 조언
  consent        boolean not null default false, -- 앱 게재 동의
  source         text                        -- 예: 「미대입시」 2026년 3월호 합격수기
);

create table reviews (                       -- 교수 심사평
  id            bigserial primary key,
  program_id    text references programs(id),
  year          int,
  reviewer      text,                        -- 익명 표기 가능 (예: ○○대 교수)
  body          text not null,
  source        text
);

-- ---------- 사용자 데이터 ----------
create table profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  name           text,
  grade          text check (grade in ('고1','고2','고3','N수')),
  gpa            numeric(4,2),
  gpa_system     gpa_system_t,
  mock_pct       numeric(5,2),
  major          major_t,
  regions        region_t[],
  academy_start  date,
  guardian_consent boolean default false,     -- 만 14세 미만 법정대리인 동의
  created_at     timestamptz default now()
);

create table awards (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  title      text not null,
  level      text,                           -- 대상/금/은/동/입선
  awarded_on date,
  verified   boolean default false           -- 「미대입시」 주최 대회 자동 인증
);

create table artworks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  image_path text not null,                  -- Supabase Storage 경로
  genre      text,
  made_on    date,
  ai_training_consent boolean default false, -- AI 학습 활용 별도 동의
  created_at timestamptz default now()
);

create table analyses (
  id          bigserial primary key,
  artwork_id  uuid references artworks(id) on delete cascade,
  model       text,                          -- 분석 모델/버전
  scores      jsonb not null,                -- {"구도":78,"형태":74,...}
  strengths   text[],
  improvements text[],
  comment     text,
  next_task   text,
  created_at  timestamptz default now()
);

create table targets (                       -- 관심·목표 대학
  user_id      uuid references auth.users(id) on delete cascade,
  admission_id text references admissions(id),
  is_primary   boolean default false,
  primary key (user_id, admission_id)
);

-- ---------- 보안: 사용자 데이터는 본인만 ----------
alter table profiles  enable row level security;
alter table awards    enable row level security;
alter table artworks  enable row level security;
alter table analyses  enable row level security;
alter table targets   enable row level security;
create policy own_profile  on profiles  for all using (auth.uid() = user_id);
create policy own_awards   on awards    for all using (auth.uid() = user_id);
create policy own_artworks on artworks  for all using (auth.uid() = user_id);
create policy own_targets  on targets   for all using (auth.uid() = user_id);
create policy own_analyses on analyses  for all using (
  exists (select 1 from artworks a where a.id = artwork_id and a.user_id = auth.uid()));

-- 입시 데이터는 누구나 읽기, 쓰기는 관리자(편집부)만 — 관리자 역할은 Supabase 대시보드에서 지정

-- =============================================================
-- 추가 설정 (스프린트 3) — Supabase SQL Editor에서 이 파일 전체를 한 번 실행
-- =============================================================

-- 입시 데이터: 누구나 읽기 (쓰기는 대시보드/관리자만)
alter table universities enable row level security;
alter table programs     enable row level security;
alter table admissions   enable row level security;
alter table results      enable row level security;
alter table exam_themes  enable row level security;
alter table pass_cases   enable row level security;
alter table reviews      enable row level security;
create policy read_all on universities for select using (true);
create policy read_all on programs     for select using (true);
create policy read_all on admissions   for select using (true);
create policy read_all on results      for select using (true);
create policy read_all on exam_themes  for select using (true);
create policy read_consented on pass_cases for select using (consent = true);
create policy read_all on reviews      for select using (true);

-- 사용자 테이블 보조 컬럼
alter table profiles add column if not exists awards_count int default 0;
alter table profiles add column if not exists updated_at timestamptz default now();
alter table artworks add column if not exists title text;

-- 작품 이미지 저장소: 비공개 버킷, 본인 폴더(<user_id>/...)만 접근
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artworks', 'artworks', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy artworks_select_own on storage.objects for select to authenticated
  using (bucket_id = 'artworks' and (storage.foldername(name))[1] = auth.uid()::text);
create policy artworks_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'artworks' and (storage.foldername(name))[1] = auth.uid()::text);
create policy artworks_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'artworks' and (storage.foldername(name))[1] = auth.uid()::text);

-- 확인용
select 'setup complete' as status;
