# 미대갈래 (앱)

월간 「미대입시」 미대 입시생용 앱. 윤대표 + Claude 자체 개발.

## 구성
- `src/` — 앱 화면 (React + TypeScript)
  - `App.tsx` 로그인·홈·내 작품·대학찾기·로드맵·마이
  - `lib/store.ts` 저장 계층 (Supabase / 데모 모드)
  - `lib/engine.ts` ★ 합격 가능성 판정 엔진 (등급 환산·실기 지수·안정/적정/소신/상향)
  - `lib/programs.json` 전국 미술대학 전형·입결 데이터 (2027 모집·2026 입결, 209개 모집단위)
  - `lib/calc.ts` 프로필→판정 입력 변환, 로드맵 계산
  - `lib/data.ts` 공통 코드(전공·장르·지역)
- `supabase/setup.sql` — Supabase SQL Editor에서 한 번 실행 (테이블·보안·작품 저장소)
- `.github/workflows/deploy.yml` — main에 올리면 GitHub Pages로 자동 배포

## 처음 설정
1. Supabase → SQL Editor → `supabase/setup.sql` 전체 붙여넣고 Run → 이어서 `supabase/migrate_v0.4.sql` Run
2. Supabase → Project Settings → API 에서 Project URL, anon(public) 키 확인
3. GitHub 저장소 → Settings → Secrets and variables → Actions → **Variables** 탭에
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록
4. GitHub 저장소 → Settings → Pages → Source: **GitHub Actions**
5. Supabase → Authentication → URL Configuration → Site URL 에 배포 주소 입력
   (예: https://아이디.github.io/midaegallae/)

## 내 컴퓨터에서 실행 (개발용)
```
npm install
cp .env.example .env   # 값 채우기 (비우면 데모 모드)
npm run dev
```

## 폰에 설치 (PWA 베타)
- 배포 주소를 폰 브라우저로 열고 → 안드로이드(삼성 인터넷·크롬): 메뉴 ⋮ → "홈 화면에 추가/앱 설치" / 아이폰(사파리): 공유 □↑ → "홈 화면에 추가"
- 아이콘·이름(미대갈래)은 `public/` 의 manifest.webmanifest, icon-*.png. 서비스워커 `public/sw.js`
- Supabase 키를 넣지 않으면 데모 모드(데이터는 그 폰에만 저장)

## 버전
- 0.8.0 (2026-10-19): 내 작품 '장르'→'분야'로 변경, 5개 계열 21개 분야로 세분화(선택창 계열별 묶음, `src/lib/data.ts` FIELD_GROUPS). 조형·공예 계열(조소·공예·입체조형)은 앞·뒤·좌·우 4면 사진을 한 작품으로 올리고 4면 평균 진단(사진 평가 한계 안내 표시, DB 변경 없음: 앞면 경로 `…-front.jpg` 규칙으로 나머지 면 연결). 마이 › 대학 실기대회 수상 시 본교 입시특전(`src/lib/benefits.ts`, 확인/편집부 확인 필요 표시). 하단 광고 배너 좌우 드래그·스와이프로 넘기기
- 0.7.1 (2026-10-18): 하단 광고를 모든 화면(첫 화면·홈·내 작품·대학찾기·학과 상세·로드맵·마이) 맨 아래로 확대, 광고 4편이 8초씩 차례로 재생. 목록은 `src/lib/ads.ts`(한 줄 추가로 광고 추가). 베타 샘플 광고 3편(가상의 아틀리에 온 미술학원·한빛예술대학교·전국 고교생 미술실기대회)은 누르면 '샘플 광고' 안내
- 0.7.0 (2026-10-18): 희망 전공에 **만화·웹툰** 추가. 이름에 '만화'·'웹툰'이 든 학과는 만화·웹툰으로 분류(만화애니메이션처럼 '애니'도 든 학과는 애니메이션 선택 시에도 표시). 웹툰 학과 13곳 22개 전형 추가(목원대 웹툰학과, 상명대 디지털만화영상, 세종대 만화애니메이션텍, 영산대·인제대·동서대·중부대·동양대·예원예술대·청주대·경일대·대구대·전주대, 출처 grinalda.net 2027) → 104곳 457행. 작품 장르에 칸만화·상황표현 추가. **Supabase 사용 시 `supabase/migrate_v0.7.sql` 한 번 실행**
- 0.6.1 (2026-10-14): 월간 「미대입시」 광고 배너(8초 영상 v2 확정본, 누르면 https://www.mgood.co.kr/main/index.php) — 첫 화면(로그인) 하단. 영상 `src/assets/ad/mgood-ad.mp4`(780×260), 첫 화면 이미지 `mgood-ad-poster.jpg`. 바꾸려면 같은 이름으로 파일만 교체
- 0.6.0 (2026-10-13): 대학 데이터 확대 49곳 209행 → 97곳 435행. 서울 순수미술(서양화·동양화·조소·판화), 경기·강원·충청, 영남·호남·제주 미술·디자인 학과 추가. 추가분은 `data/extra_2027.json`(행마다 출처 URL) → `python3 scripts/merge_extra.py` 로 `src/lib/programs.json`에 합침. 출처 대부분 학원 정리본(grinalda.net 등)·대학 모집요강·어디가 재게시 → 편집부 원문 검증 필요
- 0.5.2: 어느 브라우저에서도 설치 안내, 카카오톡 등 앱 안 브라우저는 [크롬으로 열기]
- 0.5.1 (2026-10-13): 내신·모의고사 입력칸 수정(지운 칸이 1로 다시 채워지던 문제), 앱 안 [홈 화면에 설치] 안내, 로그인 화면 배경 보티첼리 〈비너스의 탄생〉(퍼블릭 도메인, `fetch-art.yml`로 위키미디어에서 받음). 저장소: github.com/kjhouse11-prog/midaegallae · 주소: https://kjhouse11-prog.github.io/midaegallae/
- 0.5.0 (2026-10-13): 앱 이름 '미대갈래'로 변경, 폰 홈 화면 설치(PWA: 아이콘·manifest·서비스워커), package-lock.json 추가(자동 배포용)
- 0.4.0 (2026-10-12): 실제 대학 데이터 반영, '추천 대학 리스트'·'특정 학과 판정', 재학 고교·고교 유형·수상 등급 입력, 5↔9등급 환산. 데이터 갱신: `분석-2026-10/scripts/data_src.py` 수정 → programs.json 재생성
- 0.3.0 (스프린트 3): 회원가입·로그인, 입시 프로필, 수상 경력, 작품 업로드(비공개 저장소), 데모 AI 분석, 대학 매칭·로드맵
- 다음 (스프린트 4): Claude 이미지 분석 연결 (Supabase Edge Function), 대학 데이터 DB 연결
