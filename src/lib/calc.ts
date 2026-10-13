import { AXES, DRILL, type Axis } from "./data";
import type { Analysis, Artwork, Award, Profile } from "./store";
import { gpaSystemOf, type AwardLevel, type AwardScope, type Judgement, type Program, type Student } from "./engine";

export const NOW = new Date();
export const gpaSystem = (p: Profile) => gpaSystemOf(p.grade);
export function academyMonths(p: Profile) {
  if (!p.academyStart) return 0; const [y, m] = p.academyStart.split("-").map(Number);
  return Math.max(0, (NOW.getFullYear() - y) * 12 + (NOW.getMonth() + 1 - m));
}
export function workAvg(a?: Analysis | null) { if (!a) return null; const v = AXES.map((k) => a.scores[k]).filter((x): x is number => typeof x === "number"); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
export type Ctx = { p: Profile; works: Artwork[]; awards: Award[] };

// 앱 프로필 → 판정 엔진 입력
export function toStudent(c: Ctx): Student {
  const sc = c.works.map((w) => workAvg(w.analysis)).filter((x): x is number => x != null).slice(0, 3);
  return {
    grade: c.p.grade, gpa: +c.p.gpa, mock: c.p.mockKnown ? +c.p.mock : null, academyMonths: academyMonths(c.p),
    awards: c.awards.map((a) => { const [scope, level] = (a.level || "").split("|"); return { title: a.title, scope: (scope || undefined) as AwardScope | undefined, level: (level || undefined) as AwardLevel | undefined }; }),
    worksAvg: sc.length ? sc.reduce((x, y) => x + y, 0) / sc.length : null, school: c.p.school, schoolType: c.p.schoolType,
  };
}

// 학년도 기준: 고3·N수 → 올해 입시, 고2 → 내년, 고1 → 내후년 (수시 실기 10월, 정시 실기 이듬해 1월)
export function examDate(p: Profile, u: Program) {
  const base = NOW.getMonth() >= 2 ? NOW.getFullYear() : NOW.getFullYear() - 1;
  const y = { 고1: base + 2, 고2: base + 1, 고3: base, N수: base }[p.grade];
  return u.round === "수시" ? new Date(y, 9, 15) : new Date(y + 1, 0, 15);
}
export const monthsBetween = (a: Date, b: Date) => Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
export function weakest(works: Artwork[]): [Axis, number][] {
  const s: Record<string, number> = {}, n: Record<string, number> = {};
  works.forEach((w) => { if (!w.analysis) return; AXES.forEach((a) => { const v = w.analysis!.scores[a]; if (typeof v === "number") { s[a] = (s[a] || 0) + v; n[a] = (n[a] || 0) + 1; } }); });
  return AXES.filter((a) => n[a]).map((a) => [a, s[a] / n[a]] as [Axis, number]).sort((x, y) => x[1] - y[1]);
}
const examName = (u: Program) => (u.exam && !/없음|확인/.test(u.exam) ? u.exam.split("/")[0].trim() : "기초디자인");

// 판정 결과에서 '무엇을 먼저 올릴까' (반영비율 × 부족분이 큰 순)
export function priorities(j: Judgement) {
  return [...j.parts].sort((a, b) => b.w * Math.max(0, -b.margin) - a.w * Math.max(0, -a.margin));
}
export function weekTasks(c: Ctx, target?: Program, j?: Judgement) {
  const t: string[] = []; const w = weakest(c.works);
  t.push(w.length ? `약점 보완(${w[0][0]}): ${DRILL[w[0][0]]}` : "작품 2점 올리고 AI 진단 받기 (실기 지수가 추정 → 실측으로 바뀌어요)");
  if (target) t.push(`${target.univ} ${target.dept}: ${examName(target)} ${target.paper ? `(${target.paper})` : ""} 시간 재고 1회 완성`);
  const top = j && priorities(j)[0];
  if (top && top.k === "내신") t.push(`내신: ${target?.gpa_subjects || "국·영·사"} 중심으로 다음 시험 0.2등급 올리기`);
  else if (top && top.k === "수능") t.push("수능: 국어·영어 모의고사 오답 정리 (정시 반영 영역 확인)");
  else t.push(gpaSystem(c.p) === 5 ? "내신: 반영 교과(국·영·사) 수행평가 일정 챙기기" : "수능 국어·영어 모의고사 오답 정리");
  return t;
}
export function buildPlan(u: Program, j: Judgement, c: Ctx) {
  const months = monthsBetween(NOW, examDate(c.p, u)); const n = Math.min(Math.max(months, 3), 12);
  const weak = weakest(c.works).map((x) => x[0]); const order = [...weak, ...AXES.filter((a) => !weak.includes(a))];
  const study = priorities(j).find((g) => g.k !== "실기" && g.margin < 0)?.k;
  const side = study === "내신" ? [`내신: ${u.gpa_subjects} 오답노트, 시험 4주 전부터 계획표`, "내신: 수행평가 일정 관리"] : study === "수능" ? ["수능: 국어·영어 주 3회 모의고사", "수능: 탐구 1과목 개념 정리"] : ["실기 주 3회, 회당 4시간", "전시·작품집 감상 후 아이디어 노트 3장"];
  const prac = examName(u); const steps: { label: string; title: string; items: string[] }[] = [];
  let b = 0, r = 0, f = 0;
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 5))) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() + i, 1); const ph = i < n * 0.4 ? "기초 다지기" : i < n * 0.8 ? "실전 대비" : "파이널"; const items: string[] = [];
    if (ph === "기초 다지기") { const a = order[b % order.length]; items.push(`${a} 집중: ${DRILL[a]}`); items.push(side[b % side.length]); b++; }
    else if (ph === "실전 대비") { items.push(r === 0 ? `${prac} ${u.paper || ""} 시간 재고 실전 연습 주 2회` : `${prac} 실전 연습 주 3회, 회차별 점수 기록`); items.push(r === 0 ? "「미대입시」 기출·심사평 읽고 주제 3개 풀기" : "학원 모의 실기 결과 업로드해 진단 비교"); r++; }
    else { items.push(f === 0 ? "실전 모의 실기 주 3회, 시간 배분 점검" : "대학별 준비물·시험장 확인, 컨디션 관리"); items.push(f === 0 ? "AI 진단으로 약점 최종 점검" : "원서 조합 최종 점검 (수시 6장: 안정2·적정2·소신/상향2)"); f++; }
    steps.push({ label: `${d.getFullYear() % 100}.${String(d.getMonth() + 1).padStart(2, "0")}`, title: ph, items });
  }
  return { months, weak, steps };
}
// 이미지 통계 기반 데모 분석 (스프린트 4에서 Claude 이미지 분석으로 교체)
export async function demoAnalysis(url: string): Promise<Analysis> {
  const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const c = document.createElement("canvas"), N = 96; c.width = N; c.height = Math.round((N * im.height) / im.width);
  const x = c.getContext("2d")!; x.drawImage(im, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data;
  const L: number[] = []; let sat = 0, mx = 0, my = 0, mw = 0, edge = 0;
  for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255; L.push(l); const M = Math.max(r, g, b), m = Math.min(r, g, b); sat += M ? (M - m) / M : 0; const p = i / 4, wgt = 1 - l; mx += (p % c.width) * wgt; my += Math.floor(p / c.width) * wgt; mw += wgt; }
  for (let i = 1; i < L.length; i++) edge += Math.abs(L[i] - L[i - 1]);
  const mean = L.reduce((a, b) => a + b, 0) / L.length, sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / L.length);
  sat /= L.length; edge /= L.length; const off = Math.hypot(mx / mw / c.width - 0.5, my / mw / c.height - 0.5);
  const cl = (v: number) => Math.round(Math.max(52, Math.min(92, v)));
  const scores: Record<string, number | null> = { 구도: cl(88 - off * 90), 형태: cl(60 + edge * 260), 명암: cl(55 + sd * 120), 색채: sat < 0.08 ? null : cl(58 + sat * 70), 완성도: cl(62 + edge * 150 + sd * 30), 발상: cl(66 + (sd + sat) * 30) };
  const sorted = AXES.filter((a) => scores[a] != null).sort((a, b) => (scores[b] as number) - (scores[a] as number));
  const last = sorted[sorted.length - 1];
  return { model: "demo-stats", scores, strengths: [`${sorted[0]} 항목이 상대적으로 안정적이에요.`, `${sorted[1]}에서도 기본기가 보여요.`],
    improvements: [`${last} 보완이 필요해 보여요: ${DRILL[last]}`, "화면 가장자리까지 마감을 고르게 해 주세요."],
    comment: "이미지의 밝기·채도·윤곽 분포로 계산한 데모 결과입니다. 다음 업데이트에서 Claude가 작품을 직접 보고 강사 수준의 코멘트를 드립니다.", nextTask: DRILL[last] };
}
