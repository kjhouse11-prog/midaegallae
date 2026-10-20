-- v0.8 → v0.9: 입시 프로필에 계열·분야(5계열 21분야) 저장 (기존 DB에서 한 번 실행)
alter table profiles add column if not exists track text;   -- 예: '디자인 계열'
alter table profiles add column if not exists field text;   -- 예: '기초디자인'
