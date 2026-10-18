// 합격 가능성 판정 엔진 v0.4 — 대학 리스트 추천 · 특정 대학/학과 판정
// 입력: 학생 정보(내신·등급제·모의고사·학원 기간·수상·작품 진단)  ×  모집단위 데이터(programs.json)
// 출력: 안정 / 적정 / 소신 / 상향 + 근거 + 주의사항 + 데이터 신뢰도
// ※ 실기 기준점(P_req)은 경쟁률·대학 선호도로 만든 추정치입니다. 실제 합격선이 아닙니다.

export interface Program {
  id: string; univ: string; campus: string; region: string; kind: string; dept: string; major: string;
  round: "수시" | "정시"; gun: string; track: string; ttype: string; quota: number | null; method: string;
  wP: number; wG: number; wC: number; wO: number; stage1: string; exam: string; paper: string; gpa_subjects: string;
  csat_min: string; comp: number | null; gpa_best: number | null; gpa_avg: number | null; gpa_cut70: number | null;
  gpa_min: number | null; gpa_basis: string; gpa_ref: number | null; gpa_ref_est: boolean;
  csat_pct: number | null; csat_pm: number | null; eng: number | null; csat_areas: string; src: string; verify: string; note: string;
}
export type AwardLevel = "대상" | "금상" | "은상" | "동상" | "장려상" | "특선" | "입선" | "기타";
export type AwardScope = "전국" | "지역" | "교내";
export interface StudentAward { title: string; level?: AwardLevel; scope?: AwardScope }
export interface Student {
  grade: "고1" | "고2" | "고3" | "N수";
  gpa: number;                 // 내 내신 등급 (현재 등급제 기준)
  mock: number | null;         // 모의고사 평균 백분위 (모르면 null)
  academyMonths: number;       // 미술학원 다닌 개월 수
  awards: StudentAward[];
  worksAvg: number | null;     // 작품 AI 진단 평균 (없으면 null)
  school?: string; schoolType?: string;
}
export type Verdict = "안정" | "적정" | "소신" | "상향";
export interface Judgement {
  verdict: Verdict; z: number; reasons: string[]; warnings: string[]; data: "공식 입결" | "학원 추정" | "입결 없음";
  parts: { k: "내신" | "실기" | "수능"; w: number; mine: string; need: string; margin: number }[];
  practical: { v: number; req: number; est: boolean };
}

// ---------- 등급 환산 (2028 대입개편: 고1·고2 5등급제, 고3·N수 9등급제) ----------
// 등급별 누적 비율(상위 %) 경계 → 등급 중앙값(백분위 위치)으로 선형 보간
const MID9 = [2, 7.5, 17, 31.5, 50, 68.5, 83, 92.5, 98];      // 9등급제 1~9등급 중앙 위치(상위 %)
const MID5 = [5, 22, 50, 78, 95];                               // 5등급제 1~5등급 중앙 위치(상위 %)
const interp = (mids: number[], g: number) => { const i = Math.min(Math.max(g, 1), mids.length) - 1; const lo = Math.floor(i), hi = Math.min(lo + 1, mids.length - 1); return mids[lo] + (mids[hi] - mids[lo]) * (i - lo); };
const inverse = (mids: number[], top: number) => { if (top <= mids[0]) return 1; for (let k = 0; k < mids.length - 1; k++) if (top <= mids[k + 1]) return k + 1 + (top - mids[k]) / (mids[k + 1] - mids[k]); return mids.length; };
export const gpaSystemOf = (grade: Student["grade"]): 5 | 9 => (grade === "고3" || grade === "N수" ? 9 : 5);
export const topPctOf = (gpa: number, sys: 5 | 9) => interp(sys === 9 ? MID9 : MID5, gpa);
export const toGpa9 = (gpa: number, sys: 5 | 9) => (sys === 9 ? gpa : inverse(MID9, topPctOf(gpa, 5)));
export const pctToCsatGrade = (pct: number) => inverse(MID9, 100 - pct);   // 백분위 → 수능 등급(근사)

// ---------- 실기 지수 ----------
const AWARD_PT: Record<AwardLevel, number> = { 대상: 8, 금상: 7, 은상: 6, 동상: 5, 장려상: 4, 특선: 3, 입선: 2, 기타: 2 };
const SCOPE_K: Record<AwardScope, number> = { 전국: 1, 지역: 0.7, 교내: 0.4 };
export function parseAward(title: string): StudentAward {
  const rules: [RegExp, AwardLevel][] = [[/대상|최우수/, "대상"], [/금상/, "금상"], [/은상/, "은상"], [/동상/, "동상"], [/장려|우수/, "장려상"], [/특선/, "특선"], [/입선/, "입선"]];
  const level = rules.find(([re]) => re.test(title))?.[1] || "기타";
  const scope: AwardScope = /전국|국제|세계/.test(title) ? "전국" : /교내|학교/.test(title) ? "교내" : "지역";
  return { title, level, scope };
}
export function practicalIndex(s: Student) {
  const m = Math.min(Math.max(s.academyMonths, 0), 36);
  const acad = (m / 36) * 25;
  const aw = s.awards.map((a) => { const x = a.level ? a : parseAward(a.title); return AWARD_PT[x.level || "기타"] * SCOPE_K[x.scope || "지역"]; }).sort((a, b) => b - a);
  const award = Math.min((aw[0] || 0) + Math.min(aw.slice(1).length, 2), 10);
  if (s.worksAvg != null) return { v: Math.round(Math.min(s.worksAvg * 0.8 + acad * 0.4 + award * 0.5, 98)), est: false, acad, award };
  return { v: Math.round(Math.min(50 + acad + award, 95)), est: true, acad, award };
}

// ---------- 모집단위 난이도 ----------
const ownSel = (p: Program) => p.csat_pct != null ? p.csat_pct : p.gpa_ref != null ? Math.min(Math.max(100 - (p.gpa_ref - 1) * 11, 20), 98) : null;
// 같은 대학의 다른 전형(정시 성적대·수시 입결)에서 구한 대학 선호도 — 자기 입결이 없는 전형(학종 등)의 난이도 추정에 사용
let UNIV_TIER: Map<string, number> | null = null;
export function setUniverse(list: Program[]) {
  const m = new Map<string, number[]>();
  list.forEach((p) => { const v = ownSel(p); if (v != null) m.set(p.univ, [...(m.get(p.univ) || []), v]); });
  UNIV_TIER = new Map([...m].map(([k, v]) => [k, Math.max(...v)]));
}
export function selectivity(p: Program) {
  const own = ownSel(p); if (own != null) return own;
  const tier = UNIV_TIER?.get(p.univ);
  const byComp = p.comp ? Math.min(Math.max(55 + 6 * Math.log2(p.comp / 10), 40), 92) : 60;
  return tier != null ? Math.max(tier, byComp) : byComp;
}
export const requiredPractical = (p: Program) => Math.round(Math.min(Math.max(40 + 0.5 * selectivity(p) + ((p.comp || 0) > 40 ? 3 : 0), 55), 90));

// ---------- 판정 ----------
const r1 = (x: number) => Math.round(x * 10) / 10;
export function judge(p: Program, s: Student): Judgement {
  if (!UNIV_TIER) console.warn("setUniverse(programs)를 먼저 호출하세요");
  const sys = gpaSystemOf(s.grade), my9 = toGpa9(s.gpa, sys);
  const mockEst = s.mock == null; const mock = s.mock ?? Math.round(100 - topPctOf(s.gpa, sys));
  const pr = practicalIndex(s), req = requiredPractical(p);
  const reasons: string[] = [], warnings: string[] = [], parts: Judgement["parts"] = [];
  const isHak = p.ttype === "수시학종";
  const wG = p.wG + (isHak ? p.wO : 0), wP = p.wP, wC = p.wC;

  // 내신
  let gRef = p.gpa_ref, gEst = p.gpa_ref_est;
  if (wG > 0 && gRef == null) { gRef = r1(1 + (100 - selectivity(p)) / 11); gEst = true; }
  if (wG > 0 && gRef != null) {
    const m = (gRef - my9) / 0.5; parts.push({ k: "내신", w: wG, mine: `${r1(my9)}등급(9등급 환산)`, need: `${gRef}${gEst ? " (추정)" : ""}`, margin: m });
    reasons.push(`내신: 내 ${r1(my9)}등급${sys === 5 ? ` (5등급제 ${s.gpa} → 9등급 환산)` : ""} · 기준 ${gRef}등급${gEst ? "(추정)" : ""} → ${m >= 0 ? `${r1(gRef - my9)}등급 여유` : `${r1(my9 - gRef)}등급 부족`}`);
  }
  // 실기
  if (wP > 0) {
    const m = (pr.v - req) / 6; parts.push({ k: "실기", w: wP, mine: `${pr.v}${pr.est ? " (추정)" : ""}`, need: `${req} (추정)`, margin: m });
    reasons.push(`실기: 내 실기 지수 ${pr.v}${pr.est ? "(학원 기간·수상으로 추정)" : ""} · 이 학과 기준 약 ${req} → ${m >= 0 ? "충족" : `${req - pr.v}점 보완 필요`}`);
  }
  // 수능
  if (wC > 0) {
    if (p.csat_pct != null) {
      const m = (mock - p.csat_pct) / 5; parts.push({ k: "수능", w: wC, mine: `백분위 ${mock}${mockEst ? " (내신으로 추정)" : ""}`, need: `${p.csat_pct}±${p.csat_pm ?? "?"}`, margin: m });
      reasons.push(`수능: 내 백분위 ${mock}${mockEst ? "(미입력 → 내신 기준 추정)" : ""} · 합격 성적대 ${p.csat_pct}±${p.csat_pm ?? "?"} (학원 추정)`);
    } else if (p.round === "정시") {
      const need = Math.round(selectivity(p)); const m = (mock - need) / 5;
      parts.push({ k: "수능", w: wC, mine: `백분위 ${mock}${mockEst ? " (추정)" : ""}`, need: `${need} (추정)`, margin: m });
      warnings.push("이 모집단위는 수능 합격 성적대 자료가 아직 없어, 같은 대학 다른 전형의 성적대로 추정했어요.");
    }
  }
  const tw = parts.reduce((a, x) => a + x.w, 0) || 1;
  let z = parts.reduce((a, x) => a + x.w * x.margin, 0) / tw;
  let cap: Verdict | null = null;

  // 1단계 학생부 컷 (다단계)
  if (p.ttype === "수시실기다단계" && /학생부100|교과/.test(p.stage1) && p.gpa_ref != null) {
    const gate = p.gpa_min ?? (p.gpa_avg != null ? p.gpa_avg + 0.6 : p.gpa_ref + 0.3);
    if (my9 > gate + 0.2) { cap = "상향"; warnings.push(`1단계(학생부) 통과가 어려워요: 1단계 하한 약 ${r1(gate)}등급, 내 ${r1(my9)}등급.`); }
    else if (my9 > (p.gpa_avg ?? p.gpa_ref)) warnings.push(`1단계는 통과 가능권이지만 여유가 적어요 (평균 ${p.gpa_avg ?? p.gpa_ref}등급).`);
    else reasons.push("1단계(학생부) 통과 가능권 → 2단계 실기에서 결정돼요.");
  }
  // 수능최저
  const mm = p.csat_min.match(/(\d)개 영역 등급합 (\d+)/);
  if (mm) {
    const need = +mm[2] / +mm[1], mine = pctToCsatGrade(mock);
    if (mine > need + 0.3) { cap = cap || "소신"; warnings.push(`수능최저(${p.csat_min}) 충족이 불확실해요: 필요 평균 ${r1(need)}등급, 내 예상 ${r1(mine)}등급${mockEst ? "(추정)" : ""}.`); }
    else reasons.push(`수능최저(${p.csat_min}) 충족 가능권 (내 예상 ${r1(mine)}등급).`);
  }
  if (isHak) warnings.push("학생부종합은 정성평가예요. 등급은 참고일 뿐이고, 미술활동보고서·포트폴리오·면접 준비가 당락을 좌우해요.");
  if (p.wP === 100 && !p.stage1 && p.round === "수시") reasons.push("실기 100% 전형이라 내신은 반영되지 않아요.");
  if (p.wP === 100 && p.stage1) reasons.push("1단계는 학생부로 거르고, 최종 선발은 실기 100%예요.");
  if (p.ttype === "정시비실기") reasons.push("실기 없이 수능(또는 수능+서류)으로 선발해요.");
  if (s.awards.length && p.round === "수시") warnings.push("교외 수상 실적은 학생부에 기재되지 않아 입시에 직접 반영되지 않아요. 이 앱은 실기 실력을 추정하는 데만 씁니다.");
  if ((p.comp || 0) >= 40) warnings.push(`경쟁률이 매우 높아요 (2026 ${p.comp}:1). 실기 당일 변수가 큽니다.`);

  const order: Verdict[] = ["안정", "적정", "소신", "상향"];
  let v: Verdict = z >= 0.7 ? "안정" : z >= 0 ? "적정" : z >= -0.8 ? "소신" : "상향";
  if (cap && order.indexOf(v) < order.indexOf(cap)) v = cap;
  // '안정'은 근거가 충분할 때만: 실기 비중이 큰데 작품 진단 없음 / 수능을 내신으로 추정 / 입결 없음 / 학종(정성평가) → 최대 '적정'
  if (v === "안정" && ((p.wP >= 60 && pr.est) || (wC > 0 && mockEst) || p.verify.includes("미공개") || p.verify.startsWith("확인") || isHak)) v = "적정";
  const data = p.verify.startsWith("입결 공개") || p.verify === "내신 미반영" ? "공식 입결" : p.verify.startsWith("학원") ? "학원 추정" : "입결 없음";
  return { verdict: v, z: Math.round(z * 100) / 100, reasons, warnings, data, parts, practical: { v: pr.v, req, est: pr.est } };
}

const ORDER: Verdict[] = ["안정", "적정", "소신", "상향"];
// 희망 전공 ↔ 학과 분류 매칭. 만화애니메이션·웹툰애니메이션처럼 겹치는 학과는 만화·웹툰과 애니메이션 양쪽에 보여요
export const majorMatch = (p: Program, major: string) => p.major === major || (p.major === "디자인(통합)" && /디자인|미디어|공예/.test(major)) ||
  (major === "만화·웹툰" && /만화|웹툰/.test(p.dept)) || (major === "애니메이션" && /애니/.test(p.dept));
export interface Filter { major?: string; regions?: string[]; round?: "수시" | "정시" | "전체"; ttypes?: string[]; }
export function recommend(list: Program[], s: Student, f: Filter = {}) {
  if (!UNIV_TIER) setUniverse(list);
  return list
    .filter((p) => (!f.major || f.major === "전체" || majorMatch(p, f.major)) &&
      (!f.regions?.length || f.regions.includes(p.region)) && (!f.round || f.round === "전체" || p.round === f.round) && (!f.ttypes?.length || f.ttypes.includes(p.ttype)))
    .map((p) => ({ p, j: judge(p, s) }))
    // 판정 구간 순(안정→상향), 같은 구간 안에서는 선호도(난이도) 높은 대학부터
    .sort((a, b) => ORDER.indexOf(a.j.verdict) - ORDER.indexOf(b.j.verdict) || selectivity(b.p) - selectivity(a.p));
}
export const VERDICT_STYLE: Record<Verdict, { c: string; d: string }> = {
  안정: { c: "t-safe", d: "전년도 합격자보다 앞서요" }, 적정: { c: "t-fit", d: "합격자 평균 수준이에요" },
  소신: { c: "t-hope", d: "약점 보완 시 가능해요" }, 상향: { c: "t-reach", d: "현재로선 도전 지원이에요" },
};
