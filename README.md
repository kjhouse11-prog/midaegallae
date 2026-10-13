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
- 0.5.0 (2026-10-13): 앱 이름 '미대갈래'로 변경, 폰 홈 화면 설치(PWA: 아이콘·manifest·서비스워커), package-lock.json 추가(자동 배포용)
- 0.4.0 (2026-10-12): 실제 대학 데이터 반영, '추천 대학 리스트'·'특정 학과 판정', 재학 고교·고교 유형·수상 등급 입력, 5↔9등급 환산. 데이터 갱신: `분석-2026-10/scripts/data_src.py` 수정 → programs.json 재생성
- 0.3.0 (스프린트 3): 회원가입·로그인, 입시 프로필, 수상 경력, 작품 업로드(비공개 저장소), 데모 AI 분석, 대학 매칭·로드맵
- 다음 (스프린트 4): Claude 이미지 분석 연결 (Supabase Edge Function), 대학 데이터 DB 연결
