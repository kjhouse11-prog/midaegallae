-- =============================================================
-- v0.9 → v0.10: 미대 선배 멘토 매칭 (조언자 인증 · 조언 요청 · 에스크로 상태 · 정산 · 신고 · 후기 · 운영자)
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행. 실행 전에는 앱이 멘토 기록을 각 기기에 저장함.
-- 실행 후 운영자 지정: insert into admins(user_id) select id from auth.users where email = '운영자@이메일';
-- 주의: 베타는 상태 변경을 앱이 직접 기록(테스트 결제). 정식 결제 연결 때 결제·환불·정산 확정은
--       PG 웹훅을 받는 Edge Function(service role)만 바꾸도록 update 정책을 좁힘.
-- =============================================================

create table if not exists admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz default now());
alter table admins enable row level security;
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from admins where user_id = auth.uid()) $$;
drop policy if exists admins_self on admins;
create policy admins_self on admins for select using (user_id = auth.uid() or is_admin());

-- ---------- 조언자(선배) ----------
-- mentors: 공개 프로필(승인된 선배는 로그인 사용자 누구나 조회) / mentor_private: 인증 서류·정산 계좌(본인·운영자만)
create table if not exists mentors (
  id text primary key,                         -- auth.users.id (text)
  status text not null default '심사 대기' check (status in ('심사 대기','승인','반려','정지')),
  data jsonb not null,                         -- 이름·학교·학과·가능 분야·가격·소개 등
  updated_at timestamptz default now()
);
create table if not exists mentor_private (id text primary key references mentors(id) on delete cascade, data jsonb not null default '{}');
alter table mentors enable row level security;
alter table mentor_private enable row level security;
drop policy if exists mentors_read on mentors; drop policy if exists mentors_ins on mentors; drop policy if exists mentors_upd on mentors;
create policy mentors_read on mentors for select to authenticated using (status = '승인' or id = auth.uid()::text or is_admin());
create policy mentors_ins on mentors for insert to authenticated with check (id = auth.uid()::text);
create policy mentors_upd on mentors for update to authenticated using (id = auth.uid()::text or is_admin());
drop policy if exists mprivate_all on mentor_private;
create policy mprivate_all on mentor_private for all to authenticated using (id = auth.uid()::text or is_admin()) with check (id = auth.uid()::text or is_admin());

-- 본인이 스스로 '승인'으로 바꾸지 못하게: 운영자가 아니면 상태는 그대로(새 신청·재신청은 '심사 대기')
create or replace function mentors_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    if tg_op = 'INSERT' or old.status = '반려' then new.status := '심사 대기';
    else new.status := old.status; end if;
  end if;
  new.data := jsonb_set(new.data, '{status}', to_jsonb(new.status));
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists mentors_guard on mentors;
create trigger mentors_guard before insert or update on mentors for each row execute function mentors_guard();

-- ---------- 조언 요청 (결제·진행·환불 상태 포함) ----------
create table if not exists advice_requests (
  id text primary key,
  student_id text not null,                    -- 이용자 auth.uid
  mentor_id text,                              -- 수락한 선배
  target_mentor_id text,                       -- 직접 지정한 선배
  status text not null check (status in ('수락 대기','진행 중','답변 완료','구매 확정','정산 완료','환불 완료','분쟁 심사')),
  mode text not null check (mode in ('direct','auto')),
  field text not null, kind text not null, univ text default '',
  data jsonb not null,                         -- 질문·첨부·대화·환불·후기 등
  updated_at timestamptz default now()
);
create index if not exists advice_requests_open on advice_requests (status, mode, field);
alter table advice_requests enable row level security;
-- 승인된 선배인지 (자동 매칭 요청 열람·수락용)
create or replace function is_mentor() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from mentors where id = auth.uid()::text and status = '승인') $$;
drop policy if exists req_read on advice_requests; drop policy if exists req_ins on advice_requests; drop policy if exists req_upd on advice_requests;
create policy req_read on advice_requests for select to authenticated using (
  student_id = auth.uid()::text or mentor_id = auth.uid()::text or target_mentor_id = auth.uid()::text
  or (status = '수락 대기' and mode = 'auto' and is_mentor()) or is_admin());
create policy req_ins on advice_requests for insert to authenticated with check (student_id = auth.uid()::text and status = '수락 대기');
create policy req_upd on advice_requests for update to authenticated using (
  student_id = auth.uid()::text or mentor_id = auth.uid()::text or target_mentor_id = auth.uid()::text
  or (status = '수락 대기' and mode = 'auto' and is_mentor()) or is_admin());
-- 동시 수락 방지: 이미 다른 선배가 수락한 요청은 다른 선배가 가져갈 수 없음 (먼저 수락한 사람과 연결)
create or replace function req_guard() returns trigger language plpgsql as $$
begin
  if old.mentor_id is not null and new.mentor_id is distinct from old.mentor_id and not is_admin() then
    raise exception '이미 다른 선배가 수락한 요청이에요';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists req_guard on advice_requests;
create trigger req_guard before update on advice_requests for each row execute function req_guard();

-- ---------- 정산 · 신고 · 후기 · 설정 ----------
create table if not exists payouts (id text primary key, mentor_id text not null, status text not null default '신청' check (status in ('신청','지급 완료')), data jsonb not null, created_at timestamptz default now());
create table if not exists reports (id text primary key, by_id text not null, status text not null default '접수', data jsonb not null, created_at timestamptz default now());
create table if not exists mentor_reviews (req_id text primary key references advice_requests(id) on delete cascade, mentor_id text not null, by_id text not null, data jsonb not null, created_at timestamptz default now());
create table if not exists app_settings (id int primary key default 1 check (id = 1), data jsonb not null default '{}');
insert into app_settings (id, data) values (1, '{"feeRate":0.2,"directHours":12,"autoHours":6,"autoConfirmDays":3}') on conflict (id) do nothing;
alter table payouts enable row level security; alter table reports enable row level security;
alter table mentor_reviews enable row level security; alter table app_settings enable row level security;
drop policy if exists pay_read on payouts; drop policy if exists pay_ins on payouts; drop policy if exists pay_upd on payouts;
create policy pay_read on payouts for select to authenticated using (mentor_id = auth.uid()::text or is_admin());
create policy pay_ins on payouts for insert to authenticated with check (mentor_id = auth.uid()::text and status = '신청');
create policy pay_upd on payouts for update to authenticated using (is_admin());
drop policy if exists rep_read on reports; drop policy if exists rep_ins on reports; drop policy if exists rep_upd on reports;
create policy rep_read on reports for select to authenticated using (by_id = auth.uid()::text or is_admin());
create policy rep_ins on reports for insert to authenticated with check (by_id = auth.uid()::text);
create policy rep_upd on reports for update to authenticated using (is_admin());
-- 후기: 누구나 읽기, 쓰기는 그 요청을 결제·구매 확정한 이용자만
drop policy if exists rev_read on mentor_reviews; drop policy if exists rev_ins on mentor_reviews;
create policy rev_read on mentor_reviews for select to authenticated using (true);
create policy rev_ins on mentor_reviews for insert to authenticated with check (by_id = auth.uid()::text and exists (
  select 1 from advice_requests r where r.id = req_id and r.student_id = auth.uid()::text and r.status in ('구매 확정','정산 완료')));
drop policy if exists set_read on app_settings; drop policy if exists set_upd on app_settings;
create policy set_read on app_settings for select to authenticated using (true);
create policy set_upd on app_settings for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- 비공개 파일 저장소 ----------
-- mentor-docs: 인증 서류 <선배 uid>/… — 본인 올리기, 본인·운영자 보기, 운영자 삭제(심사 후 원본 삭제)
-- advice-files: 조언 첨부 <올린 사람 uid>/<요청 id>/… — 그 요청의 이용자·선배·운영자만 보기
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('mentor-docs', 'mentor-docs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('advice-files', 'advice-files', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
drop policy if exists mdocs_ins on storage.objects; drop policy if exists mdocs_sel on storage.objects; drop policy if exists mdocs_del on storage.objects;
create policy mdocs_ins on storage.objects for insert to authenticated with check (bucket_id = 'mentor-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy mdocs_sel on storage.objects for select to authenticated using (bucket_id = 'mentor-docs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy mdocs_del on storage.objects for delete to authenticated using (bucket_id = 'mentor-docs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
drop policy if exists afiles_ins on storage.objects; drop policy if exists afiles_sel on storage.objects;
create policy afiles_ins on storage.objects for insert to authenticated with check (bucket_id = 'advice-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy afiles_sel on storage.objects for select to authenticated using (bucket_id = 'advice-files' and (
  (storage.foldername(name))[1] = auth.uid()::text or is_admin() or exists (
    select 1 from advice_requests r where r.id = (storage.foldername(name))[2]
      and (r.student_id = auth.uid()::text or r.mentor_id = auth.uid()::text or r.target_mentor_id = auth.uid()::text))));

select 'migrate v0.10 complete' as status;
