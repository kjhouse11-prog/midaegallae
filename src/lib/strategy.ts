// 전형별 지원 전략 (v0.11) — 대학별 개설 전형·반영비율·수시/정시 모집인원(tracks.json) + 전형별 하향·적정·소신·상향 피드백
// tracks.json은 scripts/build_tracks.py가 그린알다 2027 미대 수시·정시 자료(대학 모집요강 정리)로 만듭니다.
import TR from "./tracks.json";
import { catOf, gpaSystemOf, majorMatch, pctToCsatGrade, practicalIndex, recommend, requiredPractical, selectivity, toGpa9, topPctOf, type Judgement, type Program, type Student, type Verdict } from "./engine";

export type Elem = "교과" | "서류" | "실기" | "면접" | "수능";
export interface Track {
  round: "수시" | "정시"; name: string; cat: string; kind?: string; itv: boolean; quota: number; units: [string, number][]; carry?: boolean;
  ratio: string; w: Record<Elem, number> | null; stage1: string; csat: string; comp: number | null; g50: number | null; g70: number | null;
  rep: string; etc: string; src: string; ids: string[]; limit?: string;
}
export interface UnivTracks { univ: string; campus: string; region: string; g: string; susi: number; jungsi: number; carry: boolean; susiPct: number | null; focus: string; tracks: Track[] }
export const TRACK_DATA = TR as unknown as { asof: string; basis: string; sources: Record<string, string>; univs: Record<string, UnivTracks>; programs: Program[] };
export const univTracks = (key: string): UnivTracks | undefined => TRACK_DATA.univs[key];

export const TRACK_CATS: { k: string; label: string; d: string }[] = [
  { k: "교과", label: "학생부교과", d: "내신 등급 중심 · 일부 면접·수능최저" },
  { k: "종합", label: "학생부종합", d: "학생부 서류 정성평가 · 면접형 포함" },
  { k: "실기", label: "실기고사", d: "대학 실기시험 중심 · 내신 일부 반영" },
  { k: "포트폴리오", label: "포트폴리오", d: "작품집 제출 · 질의응답" },
  { k: "면접", label: "면접", d: "면접이 반영되는 수시 전형 전체" },
  { k: "정시", label: "정시", d: "수능 또는 수능+실기" },
];
export const catLabel = (k: string) => TRACK_CATS.find((c) => c.k === k)?.label ?? k;
export const ELEMS: Elem[] = ["교과", "서류", "실기", "면접", "수능"];

const VS: Verdict[] = ["안정", "적정", "소신", "상향"];
const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface CatResult { k: string; label: string; n: number; cnt: Record<Verdict, number>; picks: { p: Program; j: Judgement }[]; tip: string; level: "유리" | "보통" | "불리" | "해당 없음" }
// 한 전형 분류 안에서 내 위치: 판정 구간별 개수 + 대표 대학(소신·적정·하향 각 1곳) + 내 성적과 비교한 한 줄 조언
export function catStrategy(list: Program[], st: Student, k: string, f: { major?: string; regions?: string[] } = {}): CatResult {
  const rows = recommend(list, st, { cats: [k], regions: f.regions }).filter((x) => !f.major || majorMatch(x.p, f.major));
  const cnt = Object.fromEntries(VS.map((v) => [v, rows.filter((x) => x.j.verdict === v).length])) as Record<Verdict, number>;
  // 같은 대학이 여러 번 뽑히지 않게 대학별 첫 행만
  const seen = new Set<string>(); const uniq = rows.filter((x) => { const u = x.p.univ + x.p.campus; if (seen.has(u)) return false; seen.add(u); return true; });
  const picks = (["소신", "적정", "안정"] as Verdict[]).map((v) => uniq.find((x) => x.j.verdict === v)).filter((x): x is { p: Program; j: Judgement } => !!x);
  const n = rows.length, good = cnt.안정 + cnt.적정;
  const level = !n ? "해당 없음" : good / n >= 0.5 ? "유리" : good / n >= 0.2 || cnt.소신 / n >= 0.4 ? "보통" : "불리";
  return { k, label: catLabel(k), n, cnt, picks, tip: tipFor(k, rows.map((x) => x.p), st), level };
}

function tipFor(k: string, ps: Program[], st: Student): string {
  const sys = gpaSystemOf(st.grade), my9 = r1(toGpa9(st.gpa, sys)), pr = practicalIndex(st);
  if (!ps.length) return "이 조건에 맞는 전형이 아직 없어요. 지역·전공 범위를 넓혀 보세요.";
  if (k === "교과") {
    const cut = median(ps.map((p) => p.gpa_ref).filter((x): x is number => x != null));
    const csat = ps.filter((p) => p.csat_min).length, itv = ps.filter((p) => p.wO > 0).length;
    return `내 내신 ${my9}등급(9등급 환산) · 교과 전형 70%컷 중앙값 ${cut ?? "–"}등급${cut != null ? ` → ${my9 <= cut ? `${r1(cut - my9)}등급 여유` : `${r1(my9 - cut)}등급 부족`}` : ""}. 수능최저 있는 곳 ${csat}개, 면접 있는 곳 ${itv}개.`;
  }
  if (k === "종합") {
    const itv = ps.filter((p) => p.wO > 0 || /면접/.test(p.method)).length;
    return `정성평가라 내신 ${my9}등급은 참고 지표예요. 미술·진로 관련 학생부 기록(탐구·동아리·세특)이 당락을 가르고, ${itv}개 전형은 면접까지 봐요.`;
  }
  if (k === "실기" || k === "포트폴리오") {
    const req = median(ps.map(requiredPractical));
    const base = `내 실기 지수 ${pr.v}${pr.est ? "(학원 기간·수상으로 추정)" : ""} · 기준 중앙값 약 ${req ?? "–"}`;
    return k === "실기" ? `${base} → ${req != null && pr.v >= req ? "충족권" : "보완 필요"}. 내신 반영 전형은 내신도 함께 봐요.`
      : `${base}. 포트폴리오는 완성작 10점 안팎이 필요해요${st.worksAvg == null ? " — 작품을 올려 진단받으면 판정이 정확해져요" : ""}.`;
  }
  if (k === "면접") {
    const avg = median(ps.map((p) => Math.round((p.wO / (p.wP + p.wG + p.wC + p.wO || 1)) * 100)));
    return `면접 비중 중앙값 ${avg ?? "–"}%. 판정은 면접을 뺀 성적으로 했어요 — 지원 동기·전공 이해·작품 설명 준비로 한 단계 올릴 수 있어요.`;
  }
  const need = median(ps.map((p) => p.csat_pct ?? Math.round(selectivity(p))));
  if (st.mock == null) return `모의고사 백분위를 프로필에 넣으면 정시 판정이 정확해져요(지금은 내신으로 추정). 정시 합격 성적대 중앙값 백분위 약 ${need ?? "–"}.`;
  return `내 모의고사 백분위 ${st.mock}(약 ${r1(pctToCsatGrade(st.mock))}등급) · 정시 합격 성적대 중앙값 약 ${need ?? "–"} → ${need != null && st.mock >= need ? "충족권" : "보완 필요"}.`;
}

// 수시·정시 어디에 무게를 둘지: 내신 위치 vs 모의고사 위치, 실기 지수, 관심 전형 결과
export function roundAdvice(st: Student, res: CatResult[]): { head: string; lines: string[] } {
  const sys = gpaSystemOf(st.grade), gTop = topPctOf(st.gpa, sys), pr = practicalIndex(st);
  const lines: string[] = [];
  let head = "수시·정시 병행";
  if (st.mock == null) lines.push("모의고사 백분위를 입력하면 내신과 비교해 수시·정시 중 어디가 유리한지 알려 드려요.");
  else {
    const mTop = 100 - st.mock, d = mTop - gTop;
    if (d > 10) { head = "수시 중심 · 정시는 보험"; lines.push(`내신(상위 약 ${Math.round(gTop)}%)이 모의고사(상위 약 ${Math.round(mTop)}%)보다 강해요. 교과·종합처럼 내신이 들어가는 수시 전형을 먼저 채우세요.`); }
    else if (d < -10) { head = "정시 비중 확대"; lines.push(`모의고사(상위 약 ${Math.round(mTop)}%)가 내신(상위 약 ${Math.round(gTop)}%)보다 강해요. 정시 위주 대학을 목표로 두고, 수시는 내신 영향이 적은 실기·포트폴리오 전형으로 고르세요.`); }
    else lines.push(`내신(상위 약 ${Math.round(gTop)}%)과 모의고사(상위 약 ${Math.round(mTop)}%)가 비슷해요. 수시 6장은 소신·적정 위주로, 정시는 안정권 확보용으로 나누세요.`);
  }
  if (pr.v >= 70) lines.push(`실기 지수 ${pr.v}${pr.est ? "(추정)" : ""}로 실기 비중이 큰 전형(수시 실기·정시 실기)에서 경쟁력이 있어요.`);
  else lines.push(`실기 지수 ${pr.v}${pr.est ? "(추정)" : ""} — 실기 100% 전형은 아직 부담이에요. 내신·서류 비중이 큰 전형과 섞어 지원하세요.`);
  const best = res.filter((r) => r.k !== "면접" && r.n).sort((a, b) => (b.cnt.안정 + b.cnt.적정) / b.n - (a.cnt.안정 + a.cnt.적정) / a.n)[0];
  if (best) lines.push(`관심 전형 중 지금 가장 유리한 건 ${best.label} (적정 이상 ${best.cnt.안정 + best.cnt.적정}곳 / ${best.n}곳).`);
  return { head, lines };
}

// 대학 키 = 앱의 fullName 표기 "대학(캠퍼스)"
export const univKey = (p: { univ: string; campus: string }) => `${p.univ}${p.campus ? `(${p.campus})` : ""}`;
export const catCount = (u: UnivTracks) => Object.fromEntries(TRACK_CATS.map((c) => [c.k, u.tracks.filter((t) => (c.k === "면접" ? t.round === "수시" && t.itv : t.cat === c.k)).length])) as Record<string, number>;
export { catOf };
