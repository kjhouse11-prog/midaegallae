// 나에게 맞는 학원 찾기 — 베타 '가상 예시' 학원 데이터
// ※ 아래 학원은 모두 실제로 있는 학원이 아닙니다. 기능을 시험하기 위해 만든 가상 예시이며, 이름이 실제 학원과 같더라도 관계가 없습니다.
//    교습비는 2026년 입시미술학원 정규반 시세를 참고해 만든 '예시 범위'이고, 실제 교습비는 각 학원이 교육청에 등록·게시한 금액을 확인해야 합니다.
//    정식 서비스에서는 「월간 미대입시」 제휴 학원이 직접 등록한 정보와 나이스 학원·교습소 공개자료로 바꿉니다.
import { FIELD_GROUPS } from "./data";

export interface Academy {
  id: string; name: string; region: string; area: string;
  track: string; fields: string[];            // 주력 계열과 개설 분야
  grades: string[];                           // 대상 학년
  slots: ("평일" | "주말" | "방학특강")[];
  fee: [number, number];                      // 월 교습비 예시 (만원, 정규반)
  hoursPerWeek: number; classSize: number;
  gpaCare: boolean; oneOnOne: boolean; contest: boolean; online: boolean;
  note: string;
}

// [지역, 동네] — 시·도별로 고르게
const PLACES: [string, string][] = [
  ["서울", "홍대입구"], ["서울", "강남 대치"], ["서울", "목동"], ["서울", "노원 중계"], ["서울", "건대입구"], ["서울", "신림"], ["서울", "잠실"], ["서울", "성신여대입구"],
  ["경기", "분당 서현"], ["경기", "일산 주엽"], ["경기", "수원 인계"], ["경기", "평촌"], ["경기", "부천 중동"], ["경기", "동탄"],
  ["인천", "부평"], ["인천", "송도"], ["강원", "춘천 퇴계"], ["강원", "원주 단계"],
  ["대전", "둔산"], ["세종", "나성"], ["충북", "청주 복대"], ["충남", "천안 불당"],
  ["광주", "상무지구"], ["전북", "전주 효자"], ["전남", "순천 연향"],
  ["대구", "범어"], ["대구", "동성로"], ["경북", "포항 양덕"],
  ["부산", "서면"], ["부산", "해운대"], ["울산", "삼산"], ["경남", "창원 상남"], ["제주", "제주 노형"],
];
const NAMES = ["선과면", "아틀리에 온", "그린라인", "모노톤", "컬러필드", "드로잉랩", "라인앤폼", "하얀캔버스", "새벽이젤", "블루프린트", "아트그라운드", "스튜디오 결",
  "오브제", "브러시앤펜", "페이퍼문", "아뜰리에 숲", "그리다", "포트폴리오원", "빛과그림자", "프레임", "플롯", "스케치북", "윤슬", "카툰웍스", "온도", "몽당연필",
  "팔레트나무", "점선면", "그라운드제로", "아트랩 담", "메이킹", "갈피", "다온"];
const NOTES: Record<string, string[]> = {
  "디자인 계열": ["기초디자인 주제 해석 수업 주 1회, 대학별 기출 분석반 운영", "사고의전환 소수 정예반, 매주 전 작품 개별 강평", "발상과표현 아이디어 노트 관리, 월 1회 모의 실기"],
  "회화·드로잉 계열": ["소묘·수채화 기본기 반, 석고·정물 순환 커리큘럼", "인체 크로키 매일 20분, 한국화 별도 반", "서양화·동양화 실기 대비, 대학별 재료 실습"],
  "만화·애니메이션 계열": ["상황표현·칸만화 대학별 기출 대비, 디지털 작화 병행", "애니메이션 이미지보드·캐릭터 반, 태블릿 실습실", "웹툰 포트폴리오반, 연출·콘티 수업"],
  "게임 계열": ["게임 컨셉아트·포스터 반, 디지털 페인팅 실습", "게임 상황표현 기출 대비, 원화 포트폴리오 지도"],
  "조형·공예 계열": ["조소 소조·두상 실습, 입체 작품 4면 촬영 지도", "공예·입체조형 재료 실습실, 실물 첨삭 위주"],
};
const TRACK_CYCLE = ["디자인 계열", "디자인 계열", "회화·드로잉 계열", "만화·애니메이션 계열", "디자인 계열", "조형·공예 계열", "게임 계열", "회화·드로잉 계열"];

// 같은 결과가 나오도록 고정 난수
function rnd(seed: number) { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

export const ACADEMIES: Academy[] = PLACES.map(([region, area], i) => {
  const r = rnd(i + 7); const track = TRACK_CYCLE[i % TRACK_CYCLE.length];
  const all = FIELD_GROUPS.find((g) => g.group === track)!.fields;
  const fields = all.filter((_, k) => k === 0 || r() > 0.35);
  if (track === "디자인 계열" && r() > 0.5) fields.push("소묘");          // 디자인 학원은 소묘 기초반을 함께 여는 경우가 많음
  if (track === "만화·애니메이션 계열" && r() > 0.6) fields.push("컨셉아트");
  const capital = ["서울", "경기", "인천"].includes(region);
  const lo = Math.round((capital ? 55 : 42) + r() * 15), hi = lo + Math.round(20 + r() * 30);
  const slots: Academy["slots"] = ["평일"]; if (r() > 0.25) slots.push("주말"); if (r() > 0.3) slots.push("방학특강");
  const grades = r() > 0.3 ? ["고1", "고2", "고3", "N수"] : ["고2", "고3", "N수"];
  return {
    id: `A${String(i + 1).padStart(3, "0")}`, name: `${NAMES[i % NAMES.length]} 미술학원`, region, area, track, fields: [...new Set(fields)], grades, slots,
    fee: [lo, hi], hoursPerWeek: Math.round(9 + r() * 12), classSize: Math.round(6 + r() * 12),
    gpaCare: r() > 0.55, oneOnOne: r() > 0.45, contest: r() > 0.4, online: r() > 0.6, note: NOTES[track][Math.floor(r() * NOTES[track].length)],
  };
});

export interface AcademyPref { budget: number | null; slot: "" | "평일" | "주말" | "방학특강"; gpaCare: boolean; oneOnOne: boolean }
// 내 프로필·조건과 얼마나 맞는지 점수 (100점) + 맞는 이유
export function fitAcademy(a: Academy, p: { grade: string; track: string; field: string; regions: string[] }, pref: AcademyPref) {
  let s = 0; const why: string[] = []; const miss: string[] = [];
  if (a.fields.includes(p.field)) { s += 40; why.push(`${p.field.replace("(게임)", "")} 반 있음`); }
  else if (a.track === p.track) { s += 22; why.push(`${p.track} 학원`); }
  else miss.push(`${p.field.replace("(게임)", "")} 반 없음`);
  if (!p.regions.length || p.regions.includes(a.region)) { s += 25; if (p.regions.length) why.push("선호 지역"); } else miss.push("선호 지역 밖");
  if (a.grades.includes(p.grade)) s += 5; else miss.push(`${p.grade} 반 없음`);
  if (pref.budget == null || a.fee[0] <= pref.budget) { s += 12; if (pref.budget != null) why.push("예산 안"); } else miss.push(`교습비 ${a.fee[0]}만 원부터`);
  if (!pref.slot || a.slots.includes(pref.slot)) { s += 8; if (pref.slot) why.push(`${pref.slot} 수업`); } else miss.push(`${pref.slot} 수업 없음`);
  if (pref.gpaCare) { if (a.gpaCare) { s += 5; why.push("내신 관리"); } else miss.push("내신 관리 없음"); } else s += 5;
  if (pref.oneOnOne) { if (a.oneOnOne) { s += 5; why.push("1:1 첨삭"); } else miss.push("1:1 첨삭 없음"); } else s += 5;
  return { score: Math.min(100, s), why, miss };
}

// 학원 상담 때 확인할 것
export const ACADEMY_CHECKLIST = [
  "희망 대학·분야(실기 종목)의 최근 3년 합격 실적을 학과별로 물어보기",
  "주당 수업 시간, 반 인원, 담당 강사(원장 직강 여부) 확인",
  "교습비가 교육청 등록 금액과 같은지, 재료비·특강비·모의고사비 별도 여부 확인",
  "수시 실기 기간(9~12월)·정시 실기 기간(1월) 특강 일정과 추가 비용",
  "작품 강평 방식: 매 수업 개별 강평인지, 주 1회 전체 강평인지",
  "내신·수능 공부 시간과 겹치지 않는지 (시험 기간 수업 조정 여부)",
  "학원 내 모의 실기·실기대회 참가 지원 여부",
  "환불 규정(학원법 기준)과 수강 중단 시 처리 방식",
  "통학 시간 (왕복 1시간 넘으면 주간 연습 시간이 크게 줄어요)",
  "체험 수업 1회 받아 보고 결정하기",
];

// 실제 학원을 찾을 때 쓰는 공개 자료
export const ACADEMY_SOURCES = [
  { name: "나이스 학원민원서비스 (학원·교습소 조회, 교습비)", url: "https://hakwon.neis.go.kr", note: "교육청에 등록된 학원의 위치·전화·교습과목·교습비 조회" },
  { name: "나이스 교육정보 개방 포털 (학원교습소정보 공개 데이터)", url: "https://open.neis.go.kr", note: "전국 학원·교습소 등록 정보를 내려받을 수 있는 공개 데이터" },
  { name: "공공데이터포털", url: "https://www.data.go.kr", note: "'학원교습소' 검색 → 시·도 교육청별 학원 현황" },
];
