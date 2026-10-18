-- v0.6 → v0.7: 희망전공·학과 분류에 '만화·웹툰' 추가 (기존 DB에서 한 번 실행)
alter type major_t add value if not exists '만화·웹툰';
