// 개인 맞춤 입시 플래너 · 나만의 주간 체크리스트 데이터
import { DRILL, type Axis } from "./data";

// ---------- 2027학년도 대입 주요 일정 ----------
// 출처: 한국대학교육협의회 「2027학년도 대학입학전형 시행계획」 (한국경제 생글생글 2026.02.27 정리) — 대학별 세부 일정은 모집요강 확인
export const SCHEDULE_SOURCE = { name: "대교협 2027학년도 대입전형 시행계획 (한국경제 생글생글 정리)", url: "https://sgsg.hankyung.com/article/2026022790951" };
export interface Ev { start: string; end?: string; label: string; kind: "수시" | "수능" | "정시" | "추가" }
export const SCHEDULE_2027: Ev[] = [
  { start: "2026-09-07", end: "2026-09-11", label: "수시 원서 접수 (대학별 3일 이상)", kind: "수시" },
  { start: "2026-09-12", end: "2026-12-17", label: "수시 전형 기간 (실기고사 대부분 10~11월)", kind: "수시" },
  { start: "2026-11-19", label: "2027학년도 수능", kind: "수능" },
  { start: "2026-12-11", label: "수능 성적 통지", kind: "수능" },
  { start: "2026-12-18", label: "수시 합격자 발표 마감", kind: "수시" },
  { start: "2026-12-21", end: "2026-12-23", label: "수시 합격자 등록", kind: "수시" },
  { start: "2027-01-04", end: "2027-01-07", label: "정시 원서 접수 (대학별 3일 이상)", kind: "정시" },
  { start: "2027-01-11", end: "2027-01-17", label: "정시 가군 전형 (실기고사)", kind: "정시" },
  { start: "2027-01-18", end: "2027-01-24", label: "정시 나군 전형 (실기고사)", kind: "정시" },
  { start: "2027-01-25", end: "2027-01-31", label: "정시 다군 전형 (실기고사)", kind: "정시" },
  { start: "2027-02-05", label: "정시 합격자 발표 마감", kind: "정시" },
  { start: "2027-02-10", end: "2027-02-12", label: "정시 합격자 등록", kind: "정시" },
  { start: "2027-02-19", end: "2027-02-26", label: "추가모집 원서 접수·발표", kind: "추가" },
];
export const dayDiff = (iso: string, now: Date) => Math.ceil((new Date(iso + "T00:00:00").getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5);
export const upcoming = (now: Date) => SCHEDULE_2027.filter((e) => dayDiff(e.end || e.start, now) >= 0);
// 아직 시작하지 않은 다음 일정 (D-day 표시용)
export const nextEvent = (now: Date) => SCHEDULE_2027.find((e) => dayDiff(e.start, now) >= 0);

// ---------- 학년별 연간 준비 흐름 (미술 입시생 기준) ----------
export const GRADE_ROADMAP: Record<string, { when: string; what: string }[]> = {
  고1: [
    { when: "3~6월", what: "학교 내신 기초 다지기 · 미술 기본기(소묘·색채) 시작, 관심 계열 탐색" },
    { when: "7~8월", what: "방학 특강으로 계열 체험 (디자인·회화·만화 1주씩), 실기대회 견학" },
    { when: "9~12월", what: "계열·분야 1차 결정, 학원 상담 2~3곳 비교, 첫 실기대회 출전" },
    { when: "겨울방학", what: "주력 분야 기초반 등록, 작품 기록(앱 업로드) 습관 만들기" },
  ],
  고2: [
    { when: "3~6월", what: "주력 분야 정규반, 내신 반영 교과(국·영·사) 집중, 목표 대학 10곳 추리기" },
    { when: "7~8월", what: "방학 집중반 · 대학별 기출 주제 풀이 시작, 실기대회 수상 도전" },
    { when: "9~12월", what: "수시·정시 방향 결정, 목표 대학 실기 종목·시간에 맞춘 연습" },
    { when: "겨울방학", what: "고3 대비 동계 집중반, 모의 실기 월 2회, 약점 항목 집중 보완" },
  ],
  고3: [
    { when: "3~6월", what: "실전 연습 주 3회 이상, 6월 모의평가로 수시·정시 비중 점검" },
    { when: "7~8월", what: "수시 6장 조합 확정 (안정2·적정2·소신/상향2), 대학별 기출 반복" },
    { when: "9월", what: "수시 원서 접수 · 대학별 실기 일정표 만들기" },
    { when: "10~11월", what: "수시 실기고사 · 수능 대비 병행, 컨디션 관리" },
    { when: "12~1월", what: "수능 성적으로 정시 가·나·다군 조합, 정시 실기 집중 특강" },
  ],
  N수: [
    { when: "2~3월", what: "지난 입시 결과 분석 (실기·내신·수능 중 부족 요소), 학원·재수반 결정" },
    { when: "4~8월", what: "약점 요소 집중 보완, 실전 모의 실기 주 2회, 6·9월 모의평가" },
    { when: "9~11월", what: "수시 원서·실기, 수능 대비" },
    { when: "12~1월", what: "정시 가·나·다군 조합, 정시 실기 집중" },
  ],
};

// ---------- 분야별 연습 과제 (21분야) ----------
export const FIELD_DRILLS: Record<string, string[]> = {
  기초디자인: ["기출 주제 1개 → 아이디어 썸네일 5개", "주어진 사물 2개 묘사 + 구성 4시간 완성 1장", "색채 구성 컬러칩 12색 만들기", "완성작 사진 올려 AI 진단 받기"],
  사고의전환: ["사물 1개를 3가지 관점으로 변형 스케치", "문장 주제 해석 마인드맵 1장", "4시간 완성 1장 (화면 연출 중심)", "합격작 3점 분석 노트"],
  발상과표현: ["주제어 3개로 아이디어 노트 1장", "이미지 연상 드로잉 10컷", "표현 재료 바꿔 같은 주제 2장", "완성 1장 + 자기 강평 3줄"],
  기초조형: ["점·선·면 구성 연습 3장", "평면 → 입체 전개 스케치", "재료 질감 표현 연습", "4시간 완성 1장"],
  소묘: ["석고 두상 4시간 1장", "정물 명암 5단계 연습", "30분 크로키 4장", "명암 단계 점검 사진 업로드"],
  수채화: ["정물 수채 3시간 1장", "색 번짐·겹칠 기법 연습지 1장", "명도 단계 색 띠 만들기", "완성작 AI 진단"],
  인체: ["인체 크로키 하루 20장", "손·발 부분 묘사 10컷", "인물 전신 3시간 1장", "비례 체크선 긋고 비교"],
  한국화: ["수묵 농담 연습 3장", "채색 기초 1장", "선묘(백묘) 연습 30분", "완성작 사진 기록"],
  상황표현: ["제시문 상황 연출 썸네일 6컷", "인물 동작 크로키 20장", "배경 원근 연습 1장", "4시간 완성 1장"],
  칸만화: ["4컷 콘티 3세트", "칸 연출(클로즈업·롱숏) 연습", "말풍선·효과 레이아웃 1장", "완성 1편 업로드"],
  이미지보드: ["분위기 컬러 스크립트 6컷", "배경 이미지보드 2장", "광원 설정 연습", "완성 1장 + 자기 강평"],
  캐릭터디자인: ["캐릭터 3면도 1세트", "표정 시트 12개", "실루엣 아이디어 10개", "완성작 AI 진단"],
  애니메이션: ["동작 연속 스케치 12장", "캐릭터 포즈 크로키 20장", "장면 연출 콘티 6컷", "완성 1장"],
  웹툰: ["세로 스크롤 콘티 10컷", "인물 표정·동작 연습", "배경 투시 연습 1장", "에피소드 1편 러프"],
  게임포스터: ["포스터 레이아웃 썸네일 6개", "타이포 배치 연습", "광원·대비 연습 1장", "완성 1장"],
  컨셉아트: ["실루엣 디자인 10개", "환경 컨셉 러프 2장", "재질 표현 연습", "완성 1장 업로드"],
  "상황표현(게임)": ["게임 장면 연출 썸네일 6컷", "캐릭터 액션 포즈 크로키", "이펙트·광원 연습", "4시간 완성 1장"],
  조소: ["두상 소조 3시간 1점", "부분(눈·코·귀) 소조 연습", "크로키 20장 (형태 이해)", "4면 사진 올려 진단"],
  공예: ["재료 실험 3종", "기형 아이디어 스케치 10개", "제작 1점 진행", "4면 사진 기록"],
  입체조형: ["입체 구성 아이디어 스케치 6개", "종이·와이어 모형 1점", "주제 해석 노트", "4면 사진 올려 진단"],
};

export type Direction = "수시 중심" | "정시 중심" | "수시·정시 병행";
export interface PlanSettings { direction: Direction; targetYear: number; goal: string; weeklyHours: number; practicalPct: number; practiceDays: number; academyDays: string[] }
export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
export const defaultYear = (grade: string, now: Date) => { const base = now.getMonth() >= 2 ? now.getFullYear() + 1 : now.getFullYear(); return base + ({ 고1: 2, 고2: 1, 고3: 0, N수: 0 } as Record<string, number>)[grade]; };
export const defaultSettings = (grade: string, now: Date): PlanSettings => ({ direction: "수시·정시 병행", targetYear: defaultYear(grade, now), goal: "", weeklyHours: 14, practicalPct: 60, practiceDays: 4, academyDays: ["화", "목", "토"] });

export interface Task { id: string; text: string; cat: "실기" | "내신·수능" | "작품관리" | "입시정보" | "직접 추가"; day: string; min: number; done: boolean }
export interface Week { start: string; tasks: Task[] }
// 이번 주 월요일 (YYYY-MM-DD)
export const weekStart = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

// 맞춤 주간 계획 만들기 — 주간 시간·실기 비중·연습 요일·분야·약점·목표 대학·다가오는 일정을 반영
export function makeWeek(o: { s: PlanSettings; field: string; grade: string; weak: Axis[]; targetExam?: string; targetName?: string; now: Date; seed: number }): Week {
  const { s } = o; const pmin = Math.round(s.weeklyHours * 60 * s.practicalPct / 100), smin = s.weeklyHours * 60 - pmin;
  const days = s.academyDays.length ? [...s.academyDays] : WEEKDAYS.slice(0, s.practiceDays);
  for (const d of ["토", "일", "수", "월", "금", "화", "목"]) if (days.length < s.practiceDays && !days.includes(d)) days.push(d);
  const pd = days.slice(0, Math.max(1, s.practiceDays)).sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
  const drills = FIELD_DRILLS[o.field] || FIELD_DRILLS.기초디자인;
  const prac: string[] = [];
  for (let k = 0; k < pd.length; k++) prac.push(drills[(k + o.seed) % drills.length]);
  if (o.targetExam && pd.length > 1) prac[pd.length - 1] = `${o.targetName ? o.targetName + " " : ""}${o.targetExam} 실전처럼 시간 재고 1회 완성`;
  if (o.weak[0] && pd.length > 2) prac[1] = `약점 ${o.weak[0]} 보완: ${DRILL[o.weak[0]]}`;
  const per = Math.round(pmin / pd.length / 10) * 10;
  const tasks: Task[] = pd.map((d, k) => ({ id: `p${k}`, text: prac[k], cat: "실기", day: d, min: per, done: false }));
  // 내신·수능 — 준비 방향에 따라
  const study = s.direction === "정시 중심" ? ["수능 국어 모의고사 1회 + 오답 정리", "영어 독해 지문 10개", "탐구 1과목 개념 1단원"]
    : s.direction === "수시 중심" ? ["내신 반영 교과(국·영·사) 다음 시험 범위 1단원", "수행평가 일정 확인·준비", "수능 최저가 있는 대학이면 영어 독해 10지문"]
    : ["내신 반영 교과 시험 범위 1단원", "수능 국어·영어 모의고사 오답 정리", "수행평가 일정 확인"];
  const sd = WEEKDAYS.filter((d) => !pd.includes(d)); const sper = Math.round(smin / study.length / 10) * 10;
  study.forEach((t, k) => tasks.push({ id: `s${k}`, text: t, cat: "내신·수능", day: sd[k % Math.max(1, sd.length)] || "일", min: sper, done: false }));
  tasks.push({ id: "w0", text: "이번 주 완성작 사진 올리고 AI 진단 받기", cat: "작품관리", day: "일", min: 15, done: false });
  // 다가오는 입시 일정 (4주 안)
  const ev = SCHEDULE_2027.find((e) => dayDiff(e.start, o.now) >= 0 && dayDiff(e.start, o.now) <= 28);
  if (ev && (o.grade === "고3" || o.grade === "N수")) tasks.push({ id: "e0", text: `D-${Math.max(0, dayDiff(ev.start, o.now))} ${ev.label} 준비 (대학별 일정·준비물 확인)`, cat: "입시정보", day: "월", min: 20, done: false });
  else tasks.push({ id: "e0", text: "「미대입시」 합격수기 1편 읽고 내 계획과 비교", cat: "입시정보", day: "일", min: 20, done: false });
  return { start: weekStart(o.now), tasks: tasks.sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day)) };
}
