-- v0.14 보안 보완 (Supabase 보안 점검 경고 4건 해소) — migrate_v0.13.sql 뒤에 한 번 실행
-- 1) 내부용 함수를 로그인하지 않은 사용자(anon)가 API로 호출하지 못하게 막음
--    is_admin·is_mentor 는 보안 규칙(RLS) 안에서 쓰이므로 로그인 사용자(authenticated) 실행 권한은 유지
revoke execute on function public.is_admin()  from public, anon;
revoke execute on function public.is_mentor() from public, anon;
grant  execute on function public.is_admin()  to authenticated;
grant  execute on function public.is_mentor() to authenticated;
-- 2) 트리거 전용 함수는 API로 직접 부를 일이 없음
revoke execute on function public.mentors_guard() from public, anon, authenticated;
-- 3) req_guard 의 검색 경로 고정 (다른 스키마의 같은 이름 함수로 바꿔치기 방지)
alter function public.req_guard() set search_path = public;
