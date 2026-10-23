// v0.10 미대 선배 멘토 매칭 — 조언 분야·유형·가격·수수료·정산·상태 규칙 (「매칭플랫폼 개발의뢰서」 반영)
// 구조: 이용자(입시생·학부모)가 건별로 조언을 사고, 인증된 조언자(미대 재학생·강사·원장·교수)가 건당 조언비를 받음.
// 결제금은 플랫폼이 보관(에스크로)했다가 조언 완료·구매 확정 후 수수료와 원천징수 3.3%를 떼고 정산.

export const ADVICE_FIELDS = ["서류", "면접", "포트폴리오", "학생부 교과관리", "실기"] as const;
export type AdviceField = (typeof ADVICE_FIELDS)[number];
export const FIELD_HINT: Record<AdviceField, string> = {
  서류: "자기소개서·활동 정리·학생부 기재 방향", 면접: "예상 질문·모의 면접·작품 설명 연습", 포트폴리오: "작품 선정·구성·전체 흐름 피드백",
  "학생부 교과관리": "교과 선택·내신 관리·세특 방향", 실기: "실기 작품 강평·구도·시간 안배",
};

export type AdviceKind = "small" | "big";
// 가격 구조(의뢰서 12-2 협의안): 플랫폼이 유형별 가격 범위를 정하고, 조언자는 그 범위 안에서 자기 가격을 정함.
// 자동 매칭은 플랫폼 기준가로 요청함.
export const KINDS: Record<AdviceKind, { label: string; ex: string; form: string; min: number; max: number; base: number; dueHours: number }> = {
  small: { label: "작은 조언", ex: "짧은 질문 답변, 자기소개서 한 문항 첨삭, 작품 1점 강평", form: "텍스트 채팅", min: 5000, max: 30000, base: 15000, dueHours: 48 },
  big: { label: "큰 조언", ex: "포트폴리오 전체 피드백, 모의 면접, 수시 6장 지원 전략", form: "화상·음성 또는 장문 피드백", min: 30000, max: 150000, base: 60000, dueHours: 168 },
};

export const MENTOR_ROLES = ["미대 재학생", "학원 강사", "학원 원장", "대학 교수"] as const;
export type MentorRole = (typeof MENTOR_ROLES)[number];
// 역할별 인증 서류 — 재학생은 재학증명서·성적증명서 필수(윤대표 지시), 합격증은 있으면 추가
// 학원법 제14조의2: 대학 재학생은 개인과외교습 신고 면제, 휴학생·강사 개인 교습은 신고 대상 → 재학생은 학기마다 재학 재확인
export const DOC_RULES: Record<MentorRole, { need: string[]; optional: string[] }> = {
  "미대 재학생": { need: ["재학증명서", "성적증명서"], optional: ["합격증"] },
  "학원 강사": { need: ["재직증명서", "졸업증명서"], optional: ["개인과외교습자 신고증명서", "경력증명서"] },
  "학원 원장": { need: ["학원 등록증", "졸업증명서"], optional: ["경력증명서"] },
  "대학 교수": { need: ["재직증명서"], optional: [] },
};
export const REVERIFY_DAYS = 183; // 재학 인증 유효 기간(한 학기) — 지나면 재학증명서 다시 제출
export const needReverify = (m: Mentor, now = Date.now()) => m.role === "미대 재학생" && !m.sample && !!m.docLog && now - new Date(m.docLog.checkedAt).getTime() > REVERIFY_DAYS * 864e5;
export const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export type MentorStatus = "심사 대기" | "승인" | "반려" | "정지";
export interface MentorDoc { id: string; kind: string; name: string; type: string; path: string; url?: string; at: string }
export interface Mentor {
  id: string; email: string; name: string; role: MentorRole; univ: string; dept: string; entryYear: number; admitTrack: string;
  fields: AdviceField[]; kinds: AdviceKind[]; price: Record<AdviceKind, number>; days: string[]; hours: string; intro: string;
  status: MentorStatus; reason?: string; docs: MentorDoc[]; docLog?: { kinds: string[]; checkedAt: string; checkedBy: string; purged: boolean };
  bank?: { bank: string; holder: string; last4: string }; agreed: boolean; createdAt: string; sample?: boolean; away?: boolean; warn?: number;
}

export type ReqStatus = "수락 대기" | "진행 중" | "답변 완료" | "구매 확정" | "정산 완료" | "환불 완료" | "분쟁 심사";
export interface Att { id: string; name: string; type: string; path: string; url?: string; by: "student" | "mentor"; at: string }
export interface Msg { id: string; from: "student" | "mentor" | "admin" | "system"; text: string; at: string; flags?: string[]; files?: Att[] }
export interface AdviceReq {
  id: string; studentId: string; studentName: string; studentEmail: string; minor: boolean; guardian?: string;
  field: AdviceField; univ: string; dept: string; kind: AdviceKind; mode: "direct" | "auto"; targetMentorId?: string; mentorId?: string; mentorName?: string;
  title: string; question: string; files: Att[]; workLabel?: string;
  price: number; feeRate: number; status: ReqStatus; createdAt: string; paidAt: string; acceptBy: string; acceptedAt?: string; dueAt?: string; answeredAt?: string;
  confirmedAt?: string; payoutId?: string; declined: string[]; passedOn?: boolean; messages: Msg[];
  refund?: { reason: string; at: string; amount?: number; result?: string }; review?: { rating: number; text: string; at: string };
}
export interface Payout { id: string; mentorId: string; mentorName: string; reqIds: string[]; gross: number; fee: number; earn: number; incomeTax: number; localTax: number; net: number; status: "신청" | "지급 완료"; at: string; paidAt?: string }
export interface Report { id: string; reqId?: string; mentorId?: string; mentorName?: string; byId: string; byName: string; reason: string; text: string; at: string; status: "접수" | "처리 완료"; action?: string }
export interface Review { reqId: string; mentorId: string; rating: number; text: string; at: string; by: string; field: AdviceField }
export interface Settings { feeRate: number; directHours: number; autoHours: number; autoConfirmDays: number }
export const DEFAULT_SETTINGS: Settings = { feeRate: 0.2, directHours: 12, autoHours: 6, autoConfirmDays: 3 };

export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const floor10 = (n: number) => Math.floor(n / 10) * 10;
// 조언 1건의 돈 흐름: 결제 금액 → 플랫폼 수수료 → 조언자 몫(원천징수 전)
export function split(price: number, feeRate: number) { const fee = Math.round(price * feeRate); return { price, fee, earn: price - fee }; }
// 프리랜서 사업소득 원천징수 3.3% (소득세 3% + 지방소득세 0.3%, 각각 10원 미만 버림)
export function withhold(earn: number) { const incomeTax = floor10(earn * 0.03), localTax = floor10(earn * 0.003); return { incomeTax, localTax, net: earn - incomeTax - localTax }; }

export const STATUS_STYLE: Record<ReqStatus, string> = {
  "수락 대기": "t-hope", "진행 중": "t-safe", "답변 완료": "t-safe", "구매 확정": "t-fit", "정산 완료": "t-fit", "환불 완료": "plain", "분쟁 심사": "t-reach",
};
export const STATUS_STEPS: ReqStatus[] = ["수락 대기", "진행 중", "답변 완료", "구매 확정"];

// ---------- 직거래·연락처 감지 (의뢰서 11) / 대리작업·대필 감지 (의뢰서 9) ----------
const CONTACT: [string, RegExp][] = [
  ["전화번호", /(?:\+?82[-\s.]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g],
  ["이메일", /[\w.+-]+@[\w-]+\.[\w.]+/g],
  ["메신저 아이디", /(?:카톡|카카오톡?|오픈\s?채팅|open\.kakao\.com\/\S+|텔레그램|라인\s?아이디|인스타(?:그램)?|insta(?:gram)?|디엠|DM)\s*(?:아이디|ID|id)?\s*[:：]?\s*[@\w.-]*/gi],
  ["계좌 직거래", /(?:계좌|입금|송금|직거래|현금으로|따로\s?결제)/g],
];
const PROXY = /(?:대신\s?(?:그려|그리|써|작성)|대리\s?(?:작업|제작|실기)|대필|완성본\s?(?:만들어|그려))/g;
export function scan(text: string): { clean: string; flags: string[] } {
  let clean = text; const flags: string[] = [];
  for (const [label, re] of CONTACT) {
    const hit = clean.match(re); if (!hit) continue; flags.push(label);
    if (label !== "계좌 직거래") clean = clean.replace(re, "[연락처 가림]");
  }
  if (PROXY.test(text)) flags.push("대리작업·대필 의심");
  PROXY.lastIndex = 0;
  return { clean, flags };
}

// ---------- 매칭 ----------
// 학교 이름은 '홍익대'·'홍익대학교'를 같은 학교로, 학과는 '시각디자인'·'시각디자인과'를 같은 학과로 봄
const uNorm = (s: string) => s.replace(/\(.*?\)|\s/g, "").replace(/(대학교|대학|대)$/, "");
const dNorm = (s: string) => s.replace(/\s/g, "").replace(/(학과|학부|전공|과)$/, "");
export function univHit(m: Mentor, univ: string) { return !!univ.trim() && uNorm(m.univ) === uNorm(univ); }
export function deptHit(m: Mentor, dept: string) { const d = dNorm(dept); return !!d && (dNorm(m.dept).includes(d) || d.includes(dNorm(m.dept))); }
export function rating(rs: Review[], id: string) { const x = rs.filter((r) => r.mentorId === id); return { n: x.length, avg: x.length ? x.reduce((a, r) => a + r.rating, 0) / x.length : 0 }; }
// 조건에 맞는 조언자 — 분야(필수)·유형 일치, 학교 지정 시 그 학교 출신, 학과는 가산점
export function candidates(ms: Mentor[], q: { field: AdviceField; kind: AdviceKind; univ: string; dept: string }, rs: Review[], exclude: string[] = []) {
  return ms.filter((m) => m.status === "승인" && !m.away && !exclude.includes(m.id) && m.fields.includes(q.field) && m.kinds.includes(q.kind) && (!q.univ || univHit(m, q.univ)))
    .map((m) => { const r = rating(rs, m.id); const score = (deptHit(m, q.dept) ? 30 : 0) + (q.univ ? 20 : 0) + r.avg * 8 + Math.min(r.n, 20); return { m, r, score }; })
    .sort((a, b) => b.score - a.score);
}

export const hoursLeft = (iso: string, now = Date.now()) => (new Date(iso).getTime() - now) / 36e5;
export const addHours = (h: number, from = Date.now()) => new Date(from + h * 36e5).toISOString();
export const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4); return m < 1 ? "방금" : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };
export const left = (iso: string) => { const h = hoursLeft(iso); return h <= 0 ? "마감" : h < 1 ? `${Math.max(1, Math.round(h * 60))}분 남음` : h < 48 ? `${Math.floor(h)}시간 남음` : `${Math.floor(h / 24)}일 남음`; };
export const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

// ---------- 시간이 지나면 저절로 바뀌는 상태 (요청·조회 때마다 실행) ----------
// · 직접 지정 요청이 수락 기한을 넘기면: 같은 조건의 다른 조언자에게 자동으로 넘김(1회) — 의뢰서 8
// · 자동 매칭도 기한을 넘기면: 전액 환불하고 이용자에게 알림
// · 답변 완료 후 N일 동안 확인이 없으면 자동 구매 확정
export function sweep(r: AdviceReq, s: Settings, now = Date.now()): AdviceReq | null {
  const sys = (text: string): Msg => ({ id: rid(), from: "system", text, at: new Date(now).toISOString() });
  if (r.status === "수락 대기" && hoursLeft(r.acceptBy, now) <= 0) {
    if (r.mode === "direct" && !r.passedOn) return { ...r, mode: "auto", passedOn: true, declined: [...r.declined, ...(r.targetMentorId ? [r.targetMentorId] : [])], targetMentorId: undefined, acceptBy: addHours(s.autoHours, now), messages: [...r.messages, sys(`지정한 조언자가 ${s.directHours}시간 안에 수락하지 않아 같은 조건의 다른 조언자에게 요청을 넘겼어요. ${s.autoHours}시간 안에 연결되지 않으면 전액 환불돼요.`)] };
    return { ...r, status: "환불 완료", refund: { reason: "수락 기한 안에 연결된 조언자 없음", at: new Date(now).toISOString(), amount: r.price, result: "자동 전액 환불" }, messages: [...r.messages, sys("기한 안에 수락한 조언자가 없어 결제 금액 전액을 환불했어요. 조건(학교·분야)을 넓혀 다시 요청해 보세요.")] };
  }
  if (r.status === "답변 완료" && r.answeredAt && hoursLeft(r.answeredAt, now) <= -24 * s.autoConfirmDays)
    return { ...r, status: "구매 확정", confirmedAt: new Date(now).toISOString(), messages: [...r.messages, sys(`답변 후 ${s.autoConfirmDays}일이 지나 자동으로 구매 확정됐어요.`)] };
  return null;
}

// ---------- 베타 샘플 조언자 (가상 인물 · 실제 학생 아님) ----------
const S = (id: string, name: string, univ: string, dept: string, entryYear: number, admitTrack: string, fields: AdviceField[], kinds: AdviceKind[], small: number, big: number, intro: string, role: MentorRole = "미대 재학생"): Mentor => ({
  id: "sample-" + id, email: "", name, role, univ, dept, entryYear, admitTrack, fields, kinds, price: { small, big }, days: ["화", "목", "토", "일"], hours: "평일 저녁 8~11시, 주말 오후", intro,
  status: "승인", docs: [], docLog: { kinds: role === "미대 재학생" ? ["재학증명서", "성적증명서"] : ["재직증명서"], checkedAt: "2026-10-15", checkedBy: "편집부", purged: true }, agreed: true, createdAt: "2026-10-15T00:00:00Z", sample: true,
});
export const SAMPLE_MENTORS: Mentor[] = [
  S("a", "김○○ 선배", "홍익대학교", "시각디자인과", 2025, "수시 실기", ["실기", "포트폴리오"], ["small", "big"], 15000, 70000, "기초디자인으로 합격했어요. 시간 안배와 화면 구성 강평을 꼼꼼히 해 드려요."),
  S("b", "이○○ 선배", "서울대학교", "디자인과", 2024, "수시 일반(학종)", ["서류", "면접", "학생부 교과관리"], ["small", "big"], 20000, 90000, "학종으로 합격. 자기소개·작품 설명·면접 예상 질문을 같이 정리해요."),
  S("c", "박○○ 선배", "성균관대학교", "서양화전공", 2025, "정시 실기", ["실기", "면접"], ["small", "big"], 15000, 60000, "정시 실기(소묘·수채화)로 합격. 형태와 명암 위주로 봐 드려요."),
  S("d", "최○○ 선배", "국민대학교", "공업디자인학과", 2024, "수시 실기", ["실기", "포트폴리오", "서류"], ["small", "big"], 12000, 55000, "사고의전환 합격. 발상 노트와 아이디어 스케치를 같이 봐요."),
  S("e", "정○○ 선배", "이화여자대학교", "디자인학부", 2025, "수시 미술활동보고서", ["포트폴리오", "서류", "학생부 교과관리"], ["small", "big"], 18000, 80000, "미술활동보고서·포트폴리오 구성 경험을 나눠요."),
  S("f", "강○○ 선배", "건국대학교", "커뮤니케이션디자인", 2026, "수시 실기", ["실기"], ["small"], 10000, 40000, "1학년이라 입시 기억이 생생해요. 짧은 질문 환영!"),
  S("g", "윤○○ 선배", "한국예술종합학교", "조형예술과", 2024, "실기 전형", ["실기", "포트폴리오", "면접"], ["big"], 25000, 120000, "포트폴리오 전체와 면접(작품 설명)을 깊게 봐 드려요."),
  S("h", "한○○ 원장", "(학원) 아틀리에 온", "입시미술 18년", 2008, "강사 경력", ["실기", "포트폴리오", "학생부 교과관리"], ["small", "big"], 30000, 150000, "18년 차 원장. 대학별 실기 경향과 지원 전략을 함께 짜요.", "학원 원장"),
];
export const SAMPLE_REVIEWS: Review[] = [
  ["a", 5, "구도 대안을 썸네일로 그려 주셔서 바로 이해됐어요."], ["a", 4, "답변이 빨랐어요."], ["b", 5, "면접 예상 질문이 실제로 나왔어요!"], ["b", 5, "자소서 문장을 구체적으로 고쳐 주셨어요."],
  ["c", 4, "명암 단계 설명이 좋았어요."], ["d", 5, "발상 노트 정리법이 큰 도움."], ["e", 4, "포트폴리오 순서를 바꾸니 흐름이 살아났어요."], ["g", 5, "포트폴리오 전체를 다시 보게 됐어요."], ["h", 5, "지원 대학 조합을 현실적으로 짜 주셨어요."],
].map(([m, rt, t], i) => ({ reqId: "sample-r" + i, mentorId: "sample-" + m, rating: rt as number, text: t as string, at: "2026-10-1" + (i % 9), by: "가상 이용자", field: "실기" as AdviceField }));
// 샘플 조언자가 데모에서 보내는 답변 (조언·첨삭만, 대리작업 없음)
export function sampleAnswer(r: AdviceReq): string {
  const k = r.field;
  if (k === "실기") return "작품 잘 봤어요. ① 주제부가 화면 중앙에 몰려 있어 시선 흐름이 멈춰요. 주제부를 1/3 지점으로 옮기고 보조 요소를 대각선으로 배치해 보세요. ② 명암 단계가 3단계 정도라 평면적이에요. 가장 어두운 곳과 밝은 곳을 먼저 정하고 5단계로 나눠 보세요. ③ 마지막 30분은 새로 그리기보다 가장자리 정리에 쓰세요. 다음 연습: 같은 주제로 썸네일 6개 → 하나 골라 3시간 완성.";
  if (k === "면접") return "예상 질문 5개를 정리했어요. ① 이 작품에서 가장 고민한 부분은? ② 우리 학과를 선택한 이유 ③ 좋아하는 디자이너·작가 ④ 입학 후 해 보고 싶은 작업 ⑤ 실패한 작품에서 배운 점. 답변은 '결론 → 근거(작품 경험) → 앞으로' 순서로 1분 안에 말하는 연습을 해 보세요.";
  if (k === "서류") return "문항을 읽어 봤어요. 활동 나열보다 '무엇을 느끼고 어떻게 바뀌었는지'가 드러나야 해요. 첫 문장을 경험의 장면으로 시작하고, 마지막 문장은 전공과 이어지게 바꿔 보세요. 표현은 학생 본인의 말로 다시 써 주세요(대필은 하지 않아요).";
  if (k === "포트폴리오") return "구성 순서를 이렇게 제안해요. ① 가장 자신 있는 대표작 ② 과정(스케치·발상 노트) ③ 다양한 재료 실험 ④ 마무리 작품. 비슷한 작품 2점은 1점으로 줄이고, 작품마다 한 줄 설명을 붙여 주세요.";
  return "학생부를 보면 미술 교과 세특은 좋은데 일반 교과와의 연결이 약해요. 다음 학기 탐구 활동에서 디자인과 연결되는 주제(예: 색채와 심리, 공공디자인 조사)를 잡아 보세요. 내신은 반영 교과를 먼저 확인하세요.";
}
