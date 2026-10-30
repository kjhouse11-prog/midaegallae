-- v0.13 앱 안 회원 탈퇴 (앱스토어·플레이스토어 필수: 앱에서 가입하면 앱에서 탈퇴할 수 있어야 함)
-- Supabase → SQL Editor 에서 한 번 실행. 앞선 migrate_v0.10.sql 실행 뒤에 실행하세요.
-- 순서: 앱이 먼저 내 작품·인증 서류 파일을 Storage API로 지움(SQL로 storage.objects 직접 삭제 불가) → 이 함수가 계정 삭제
-- auth.users 삭제 시 profiles·awards·artworks·analyses·targets·marketing_consents·admins 는 on delete cascade 로 함께 삭제
-- 선배 프로필(mentors)·정산 계좌(mentor_private)도 삭제. 조언 요청·결제·정산 기록은 전자상거래법(대금 결제 5년) 보관 대상이라 남기되
-- 연락처·이름 없이 아이디만 남음(탈퇴 회원으로 표시)
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception '로그인이 필요해요'; end if;
  if to_regclass('public.mentors') is not null then
    delete from mentors where id = me::text;
  end if;
  delete from auth.users where id = me;
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
