-- v0.3 → v0.4: 프로필에 재학 고교·고교 유형 추가, 수상 경력에 상 등급·규모 저장 (setup.sql 실행 후 한 번 실행)
alter table profiles add column if not exists school      text;
alter table profiles add column if not exists school_type text default '일반고';
alter table profiles add column if not exists updated_at  timestamptz default now();
alter table awards   add column if not exists level       text;   -- 예: '전국|장려상'
alter type  major_t  add value if not exists '디자인(통합)';
