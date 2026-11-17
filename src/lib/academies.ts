// 입시미술학원 찾기 — 「월간 미대입시」 전국 입시 미술학원 현황 (2026)
// 데이터: src/lib/academies.json (scripts/build_academies.py로 엑셀에서 생성)
// ※ 공모전 접수 명단에서 정리한 자료라, 휴대전화(원장·담당자 개인번호일 수 있음)는 공개 데이터에서 뺐어요.
//    교습비·수업 시간·개설 분야는 이 자료에 없으므로 학원 상담·나이스 학원민원서비스에서 확인해야 해요.

import { SUPPORT_EMAIL } from "../config";

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

// ---------- v0.13 학원찾기 세밀화 ----------
// 동·읍·면 — 주소 괄호 안 법정동(예: (대치동)) 또는 주소 속 읍·면 이름
export function dongOf(a: Academy): string {
  const m = a.addr.match(/\(([가-힣0-9]+(?:동|가|리))(?:[,)]|\s)/); if (m) return m[1];
  const t = a.addr.split(/\s+/).find((w, i) => i >= 2 && /^[가-힣0-9]+(?:읍|면|동)$/.test(w));
  return t || "";
}
export const kakaoMapUrl = (a: Academy) => `https://map.kakao.com/link/search/${encodeURIComponent(`${a.name} ${a.addr.replace(/\s*\(.*$/, "")}`)}`;
// 정보 수정 요청 — 고객센터 이메일(VITE_SUPPORT_EMAIL)이 정해지면 메일, 아니면 「월간 미대입시」 누리집
export const reportUrl = (a: Academy) => SUPPORT_EMAIL
  ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[미대갈래] 학원 정보 수정 요청 - ${a.name} (${a.id})`)}&body=${encodeURIComponent(`학원명: ${a.name}\n주소: ${a.addr}\n전화: ${a.tel || "-"}\n\n바뀐 내용(이전·폐원·전화번호·전문 분야 등):\n`)}`
  : "https://www.mgood.co.kr/main/index.php";

// 상담 노트 — 학원을 직접 상담·체험한 뒤 기록해 두고 비교 (이 기기 저장)
export const NOTE_RATES = ["강평", "합격 실적", "분위기", "상담 신뢰"] as const;
export type NoteRate = (typeof NOTE_RATES)[number];
export interface AcadNote {
  id: string;                     // 학원 id
  on: string;                     // 상담일
  fee: number | null;             // 월 교습비 (만 원)
  extra: number | null;           // 월 재료비·특강비 등 별도 (만 원)
  hours: number | null;           // 주당 수업 시간
  size: number | null;            // 반 인원
  commute: number | null;         // 편도 통학 시간 (분)
  teacher: "" | "원장 직강" | "전담 강사" | "강사 여러 명";
  trial: boolean;                 // 체험 수업 받음
  record: string;                 // 들은 합격 실적 (학과별)
  rate: Partial<Record<NoteRate, number>>;   // 1~5
  memo: string;
}
export const emptyNote = (id: string): AcadNote => ({ id, on: new Date().toISOString().slice(0, 10), fee: null, extra: null, hours: null, size: null, commute: null, teacher: "", trial: false, record: "", rate: {}, memo: "" });
// 한 달 4.3주 기준 시간당 비용 (원)
export const perHour = (n: AcadNote) => (n.fee && n.hours ? Math.round(((n.fee + (n.extra || 0)) * 10000) / (n.hours * 4.3)) : null);
export const rateAvg = (n: AcadNote) => { const v = NOTE_RATES.map((k) => n.rate[k]).filter((x): x is number => !!x); return v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1) : null; };
// 비교 점수(100점): 평가 50 + 시간당 비용 20 + 반 인원 15 + 통학 15 — 입력한 항목만으로 환산
export function noteScore(n: AcadNote): number | null {
  const parts: [number, number][] = [];
  const r = rateAvg(n); if (r) parts.push([((r - 1) / 4) * 50, 50]);
  const ph = perHour(n); if (ph) parts.push([Math.max(0, Math.min(1, (40000 - ph) / 30000)) * 20, 20]);       // 1만 원 이하 만점, 4만 원 이상 0
  if (n.size) parts.push([Math.max(0, Math.min(1, (25 - n.size) / 17)) * 15, 15]);                             // 8명 이하 만점, 25명 이상 0
  if (n.commute != null) parts.push([Math.max(0, Math.min(1, (60 - n.commute) / 45)) * 15, 15]);               // 15분 이하 만점, 60분 이상 0
  if (!parts.length) return null;
  const got = parts.reduce((s, [g]) => s + g, 0), max = parts.reduce((s, [, m]) => s + m, 0);
  return Math.round((got / max) * 100);
}

// 학원 유형 — 어떤 학원이 나에게 맞나
export const ACADEMY_TYPES = [
  { name: "종합 입시미술학원", fit: "디자인·회화·조소 등 여러 반 운영, 대학별 실기 특강과 모의 실기가 많음", watch: "반 인원이 많으면 개인 강평 시간이 짧아질 수 있어요. 내 종목 전담 강사가 있는지 확인" },
  { name: "분야 전문 학원 (디자인·만화애니·게임·조소)", fit: "한 분야 실기 종목에 집중, 해당 학과 합격 사례가 쌓여 있음", watch: "지원 대학의 실기 종목이 학원 전문 분야와 맞는지, 다른 종목 대학도 쓸 때 대비가 되는지 확인" },
  { name: "개인 화실·교습소", fit: "소수 인원, 기초 소묘·수채화를 꼼꼼히 다질 때 (고1·예비 고1)", watch: "대학별 실기 정보·모의 실기·입시 상담이 부족할 수 있어 고2 후반부터는 입시 학원 병행·전환을 검토" },
  { name: "인터넷 강의·온라인 첨삭", fit: "통학이 어려운 지역, 학원과 병행해 약점 보완", watch: "실기는 손으로 해야 늘어요. 매주 실제 완성작을 그리고 강평받는 흐름을 꼭 만들기" },
];

// 학년별 학원 시작·운영 가이드
export const GRADE_ACADEMY_GUIDE: Record<string, { when: string; how: string[] }> = {
  고1: { when: "기초 다지기 · 주 2~3회(주말반·방학 특강)", how: ["소묘·수채화·기초 조형으로 형태·명암·색 감각부터", "내신 1학년 성적이 수시 교과·학종의 바탕이라 시험 기간에는 수업 조정 가능한 곳", "희망 계열(디자인·회화·만화애니·조소)을 2학기까지 정하기"] },
  고2: { when: "실기 종목 확정 · 주 3~4회", how: ["목표 대학 2~3곳의 실기 종목(기초디자인·사고의전환·발상과표현·소묘 등)으로 반 정하기", "여름방학부터 시간 재고 완성작 연습(3~5시간)", "학원 모의 실기·외부 실기대회로 실전 감각"] },
  고3: { when: "대학별 맞춤 · 주 4~6회, 수시 실기 기간 특강", how: ["수시 6장 조합에 맞춰 대학별 기출 주제·종이 크기·시간으로 연습", "9~12월 수시 실기, 1~2월 정시 실기 특강 일정·비용 미리 확인", "수능최저가 있는 전형은 수능 공부 시간을 따로 확보"] },
  N수: { when: "종일반 · 실기와 수능 병행", how: ["정시(수능+실기) 비중이 크므로 수능 성적 목표를 먼저 정하기", "오전 수능·오후 실기처럼 하루 시간표가 분명한 반", "지난해 떨어진 원인(실기·내신·수능)을 상담 때 함께 분석"] },
};

// 학원법 시행령 [별표 4] 교습비등 반환 기준 (교습 기간 1개월 이내)
export const REFUND_RULES = [
  ["교습 시작 전", "이미 낸 교습비 전액"],
  ["총 교습 시간의 1/3 지나기 전", "이미 낸 교습비의 2/3"],
  ["총 교습 시간의 1/2 지나기 전", "이미 낸 교습비의 1/2"],
  ["총 교습 시간의 1/2 지난 뒤", "반환하지 않음"],
] as const;
export const REFUND_NOTE = "교습 기간이 1개월을 넘으면 남은 달의 교습비는 전액, 해당 달은 위 기준으로 돌려받아요. 학원은 교습비·기타경비를 학원 안과 누리집에 게시해야 하고, 게시·등록 금액보다 많이 받을 수 없어요(학원의 설립·운영 및 과외교습에 관한 법률 제15조·제18조).";

// 목표 대학·학과와 내 학년·분야에 맞춘 상담 질문
export function askList(o: { grade: string; field: string; track: string; target?: { univ: string; dept: string; exam: string; paper: string; round: string; cat?: string; wP: number } }): string[] {
  const q: string[] = [];
  const t = o.target;
  if (t) {
    const ex = t.exam && !/없음|확인/.test(t.exam) ? t.exam : "";
    if (ex) q.push(`${t.univ} ${t.dept} 실기 종목 '${ex}${t.paper ? `(${t.paper})` : ""}' 반이 따로 있나요? 같은 조건으로 시간 재고 연습하나요?`);
    q.push(`최근 3년 ${t.univ} ${t.dept}(또는 같은 실기 종목 학과) 합격자는 몇 명인가요? 수시·정시 나눠서 알려 주세요.`);
    if (!t.wP) q.push(`${t.univ}는 실기 없는 전형이에요. 포트폴리오·면접·학생부 관리도 도와주나요?`);
    if (t.cat === "포트폴리오") q.push("포트폴리오 제작 지도 기간과 비용, 작품 수·형식(파일·실물)을 어떻게 맞추나요?");
    if (t.round === "정시") q.push("정시 실기(1월) 대비 특강 일정과, 수능 공부와 병행하는 시간표는 어떻게 되나요?");
  } else q.push(`${o.field} 종목으로 합격한 학생이 많은 대학·학과는 어디인가요? (대학찾기에서 목표 대학을 정하면 질문이 더 구체적으로 바뀌어요)`);
  if (/조소|입체|공예/.test(o.field)) q.push("소조 재료(점토·석고)·공구 실습 공간과 작품 보관은 어떻게 하나요?");
  if (/만화|애니|웹툰|캐릭터|게임|컨셉/.test(o.field + o.track)) q.push("디지털(태블릿) 실기를 보는 대학 대비도 하나요? 장비는 개인 준비인가요?");
  if (o.grade === "고1") q.push("기초반에서 입시반으로 넘어가는 시기와 기준은 언제인가요?");
  if (o.grade === "고3") q.push("수시 실기 기간(9~12월) 대학별 맞춤 특강 일정과 추가 비용은 얼마인가요?");
  if (o.grade === "N수") q.push("재수 종일반 시간표와 수능 공부 병행 방식은 어떻게 되나요?");
  q.push("월 교습비 외에 재료비·특강비·모의고사비가 따로 있나요? 교육청 등록 금액과 같은가요?");
  return q;
}
