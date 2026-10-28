// 입시미술학원 찾기 — 「월간 미대입시」 전국 입시 미술학원 현황 (2026)
// 데이터: src/lib/academies.json (scripts/build_academies.py로 엑셀에서 생성)
// ※ 공모전 접수 명단에서 정리한 자료라, 휴대전화(원장·담당자 개인번호일 수 있음)는 공개 데이터에서 뺐어요.
//    교습비·수업 시간·개설 분야는 이 자료에 없으므로 학원 상담·나이스 학원민원서비스에서 확인해야 해요.

export interface Academy {
  id: string; sido: string; gugun: string; name: string; addr: string; zip: string;
  tel: string | null;                          // 학원 대표번호 (휴대전화는 비공개 처리)
  tags: string[];                              // 학원명으로 알 수 있는 전문 분야 (만화·애니, 디자인, 한국화, 게임, 조소·조형)
}

export const ACADEMY_TAGS = ["만화·애니", "디자인", "한국화", "게임", "조소·조형"];

// 내 계열·분야에 맞는 학원명 분야 표시
export function myTags(track: string, field: string): string[] {
  if (track.startsWith("만화")) return ["만화·애니"];
  if (track.startsWith("게임")) return ["게임", "만화·애니"];
  if (track.startsWith("조형")) return ["조소·조형"];
  if (track.startsWith("디자인")) return ["디자인"];
  if (/한국화|동양화/.test(field)) return ["한국화"];
  return [];
}

// 지역 → 구·군 목록
export function guguns(list: Academy[], sido: string) {
  return [...new Set(list.filter((a) => a.sido === sido).map((a) => a.gugun))].sort();
}

export const mapUrl = (a: Academy) => `https://map.naver.com/p/search/${encodeURIComponent(`${a.name} ${a.addr.replace(/\s*\(.*$/, "")}`)}`;

export const ACADEMY_DATA_NOTE = "「월간 미대입시」 전국 입시 미술학원 현황 (2026, 실기대회 접수 학원 기준)";

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
