// v0.13 대학진로 화면 — 학과·진로(배우는 것·직업·자격·고교 준비·수록 대학 통계) / 실기 종목으로 대학 찾기 / 학과 상세의 합격 준비 체크
import { useMemo, useState } from "react";
import { MAJORS } from "./lib/data";
import { judge, majorMatch, recommend, VERDICT_LABEL, VERDICT_STYLE, hasInterview, type Program, type Student, type Verdict } from "./lib/engine";
import { CAREER_SOURCES, EXAMS, FIELD_EXAMS, MAJOR_GUIDE, examsOf, majorStats } from "./lib/careers";
import { catLabel, catOf } from "./lib/strategy";

const ORDER: Verdict[] = ["안정", "적정", "소신", "상향"];
type Common = { list: Program[]; st: Student; open: (id: string) => void; fullName: (p: Program) => string };

function Bars({ rows, total }: { rows: [string, number][]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return <div className="bars">{rows.map(([k, v]) => <div className="cbar" key={k}><span>{k}</span><i style={{ width: `${(v / max) * 100}%` }} /><em>{Math.round((v / Math.max(1, total)) * 100)}%</em></div>)}</div>;
}
const Chips = ({ xs }: { xs: string[] }) => <div className="career-jobs">{xs.map((x) => <span key={x}>{x}</span>)}</div>;

export function CareerPanel({ list, st, open, fullName, major, setMajor }: Common & { major: string; setMajor: (m: string) => void }) {
  const g = MAJOR_GUIDE[major] || MAJOR_GUIDE["기타"];
  const rows = useMemo(() => list.filter((p) => majorMatch(p, major)), [list, major]);
  const s = useMemo(() => majorStats(rows), [rows]);
  const rec = useMemo(() => recommend(rows, st), [rows, st]);
  const cnt = Object.fromEntries(ORDER.map((v) => [v, rec.filter((x) => x.j.verdict === v).length])) as Record<Verdict, number>;
  const picks = rec.filter((x) => x.j.verdict === "적정" || x.j.verdict === "소신").slice(0, 5);
  const cats = Object.entries(rows.reduce((m, p) => { const k = catLabel(catOf(p)); m[k] = (m[k] || 0) + 1; return m; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]) as [string, number][];
  return <>
    <p className="lead">학과에서 무엇을 배우고 졸업 후 어디로 가는지, 수록된 대학 데이터와 내 판정까지 한 번에 봐요.</p>
    <div className="tags pick" role="group" aria-label="전공">{MAJORS.map((m) => <button key={m} aria-pressed={major === m} onClick={() => setMajor(m)}>{m}</button>)}</div>
    <div className="card"><b>{major}</b><span className="small">{g.intro}</span>
      <span className="tiny">주로 배우는 과목</span><Chips xs={g.learn} />
      <span className="tiny">자주 보는 실기 종목</span><span className="small"><b>{g.exams}</b></span></div>
    <div className="card"><b>졸업 후 진로</b>
      <span className="tiny">직업</span><Chips xs={g.jobs} />
      <span className="tiny">진출 분야</span><span className="small">{g.fields.join(" · ")}</span>
      <span className="tiny">관련 자격</span><ul className="list small">{g.certs.map((x) => <li key={x}>{x}</li>)}</ul></div>
    <div className="card"><b>고등학교 때 준비</b><ul className="list small">{g.prep.map((x) => <li key={x}>{x}</li>)}</ul></div>
    <h2 className="sec">수록 대학 데이터 ({s.univ}개 대학 · {s.n}개 모집단위)</h2>
    {s.n ? <>
      <div className="card"><div className="grid3">
        <div className="stat"><span className="k">대학</span><span className="v">{s.univ}</span></div>
        <div className="stat"><span className="k">모집단위</span><span className="v">{s.n}</span></div>
        <div className="stat"><span className="k">평균 경쟁률</span><span className="v" style={{ fontSize: 18 }}>{s.comp ? `${s.comp}:1` : "–"}</span></div></div>
        <span className="tiny">지역</span><Bars rows={s.region} total={s.n} />
        <span className="tiny">전형</span><Bars rows={cats} total={s.n} />
        {s.exams.length > 0 && <><span className="tiny">실기 종목 (택1 종목은 모두 셈)</span><Bars rows={s.exams.slice(0, 7)} total={s.n} /></>}
      </div>
      <div className="card"><b>지금 내 판정</b>
        <span className="small">하향(안정) {cnt.안정} · 적정 {cnt.적정} · 소신 {cnt.소신} · 상향 {cnt.상향}</span>
        {picks.length > 0 ? <div className="plist">{picks.map(({ p, j }) => <button key={p.id} className="pick" onClick={() => open(p.id)}><span><b className="small">{fullName(p)}</b><br /><span className="tiny">{p.dept} · {catLabel(catOf(p))} · {p.region}</span></span><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{VERDICT_LABEL[j.verdict]}</span></button>)}</div>
          : <span className="tiny">적정·소신 대학이 없어요. 추천 리스트에서 지역·전형을 넓혀 보세요.</span>}</div>
    </> : <div className="notice">이 전공으로 수록된 모집단위가 아직 없어요.</div>}
    <div className="card"><b>더 알아보기</b>{CAREER_SOURCES.map((x) => <a key={x.url} className="srclink" href={x.url} target="_blank" rel="noopener"><b className="small">{x.name}</b></a>)}
      <span className="tiny">학과 교육과정·진로는 대학마다 달라요. 지원 학과 누리집의 교육과정표와 졸업생 진로를 꼭 확인하세요.</span></div>
  </>;
}

export function ExamPanel({ list, st, open, fullName, major, field }: Common & { major: string; field: string }) {
  const mineEx = FIELD_EXAMS[field] || [];
  const [ex, setEx] = useState(mineEx[0] || "기초디자인"), [mine, setMine] = useState(false);
  const e = EXAMS.find((x) => x.k === ex)!;
  const counts = useMemo(() => Object.fromEntries(EXAMS.map((x) => [x.k, list.filter((p) => x.re.test(p.exam || "")).length])), [list]);
  const rows = useMemo(() => list.filter((p) => e.re.test(p.exam || "") && (!mine || majorMatch(p, major))).map((p) => ({ p, j: judge(p, st) }))
    .sort((a, b) => ORDER.indexOf(a.j.verdict) - ORDER.indexOf(b.j.verdict) || (b.p.comp || 0) - (a.p.comp || 0)), [list, ex, mine, major, st]);
  const [n, setN] = useState(30);
  return <>
    <p className="lead">내가 연습하는 실기 종목으로 볼 수 있는 대학·학과를 모았어요.{mineEx.length ? ` 프로필 분야(${field}) 기준 추천 종목: ${mineEx.join(" · ")}` : ""}</p>
    <div className="tags pick" role="group" aria-label="실기 종목">{EXAMS.filter((x) => counts[x.k]).map((x) => <button key={x.k} aria-pressed={ex === x.k} onClick={() => { setEx(x.k); setN(30); }}>{mineEx.includes(x.k) ? "★ " : ""}{x.k} {counts[x.k]}</button>)}</div>
    <div className="card"><b>{e.k}</b><span className="small muted">{e.d}</span>
      <label className="check"><input type="checkbox" checked={mine} onChange={(x) => setMine(x.target.checked)} /><span>{major} 관련 학과만</span></label>
      <span className="tiny">{rows.length}개 모집단위 · 하향(안정)·적정 먼저 · 여러 종목 중 택1인 학과도 포함</span></div>
    {rows.slice(0, n).map(({ p, j }) => <button key={p.id} className="card-btn" onClick={() => open(p.id)}><div className="card uni">
      <div className="row between"><span className="name">{fullName(p)}</span><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{VERDICT_LABEL[j.verdict]}</span></div>
      <div className="small muted">{p.dept} · {p.round} {catLabel(catOf(p))} · {p.region}{p.comp ? ` · ${p.comp}:1` : ""}</div>
      <div className="tiny">{p.exam}{p.paper ? ` · ${p.paper}` : ""}</div></div></button>)}
    {rows.length > n && <button className="btn line block" onClick={() => setN(n + 30)}>더 보기 (남은 {rows.length - n}개)</button>}
    {!rows.length && <div className="notice">이 종목으로 수록된 모집단위가 없어요.</div>}
  </>;
}

// 학과 상세: 이 학과 진로 요약 + 합격 준비 체크 (전년도 입결·전형 요소로 만든 체크리스트)
export function PassPrep({ u, st, toCareer }: { u: Program; st: Student; toCareer: (major: string) => void }) {
  const j = judge(u, st);
  const g = MAJOR_GUIDE[u.major] || (u.major === "디자인(통합)" ? MAJOR_GUIDE["시각디자인"] : MAJOR_GUIDE["기타"]);
  const ex = examsOf(u);
  const items: { t: string; ok: boolean | null }[] = [];
  if (u.wG > 0 && u.round === "수시") { const ref = u.gpa_cut70 ?? u.gpa_avg ?? u.gpa_ref; items.push({ t: ref ? `내신: 2026 합격자 ${u.gpa_cut70 ? "70% 컷" : "평균"} ${ref}등급 (반영 ${u.gpa_subjects || "대학 확인"})` : `내신 반영: ${u.gpa_subjects || "대학 모집요강 확인"}`, ok: j.parts.find((x) => x.k === "내신") ? j.parts.find((x) => x.k === "내신")!.margin >= 0 : null }); }
  if (u.wP > 0) items.push({ t: `실기: ${u.exam || "종목 확인 필요"}${u.paper ? ` · ${u.paper}` : ""} — 같은 종이·시간으로 주 2회 완성작`, ok: j.parts.find((x) => x.k === "실기") ? j.parts.find((x) => x.k === "실기")!.margin >= 0 : null });
  if (u.csat_min) items.push({ t: `수능최저: ${u.csat_min} — 모의고사로 충족 여부 점검`, ok: null });
  if (u.wC > 0) items.push({ t: `수능: ${u.csat_areas || "반영 영역 확인"}${u.csat_pct ? ` · 합격 성적대 백분위 약 ${u.csat_pct}` : ""}`, ok: j.parts.find((x) => x.k === "수능") ? j.parts.find((x) => x.k === "수능")!.margin >= 0 : null });
  if (catOf(u) === "종합" || catOf(u) === "포트폴리오") items.push({ t: catOf(u) === "포트폴리오" ? "포트폴리오: 대학이 정한 작품 수·형식에 맞춰 대표작 선정, 제작 과정 기록" : "서류: 학생부 미술·진로 활동 기록, 미술활동보고서가 있으면 작품 설명 준비", ok: null });
  if (u.round === "수시" && hasInterview(u)) items.push({ t: "면접: 지원 동기·작품 설명 1분 답변, 학과 교육과정 미리 읽기", ok: null });
  return <>
    <div className="card"><b>합격하려면 이것부터 (2027 전형 · 2026 입결 기준)</b>
      <div className="plist">{items.map((x) => <div key={x.t} className="row between" style={{ gap: 8, alignItems: "flex-start" }}><span className="small">{x.t}</span>{x.ok != null && <span className={`chip ${x.ok ? "t-fit" : "t-reach"}`} style={{ flexShrink: 0 }}>{x.ok ? "충족" : "보완"}</span>}</div>)}</div>
      {ex.length > 0 && <span className="tiny">이 학과 실기 종목: {ex.join(" · ")} — 대학찾기 › 실기 종목에서 같은 종목 대학을 함께 볼 수 있어요.</span>}
      <span className="tiny">「미대입시」 합격수기·교수 심사평 데이터가 연결되면 이 학과 합격자의 실제 준비 과정이 여기에 함께 보여요.</span></div>
    <div className="card"><b>이 학과 졸업 후</b><Chips xs={g.jobs.slice(0, 6)} /><span className="tiny">관련 자격: {g.certs.slice(0, 3).join(" · ")}</span>
      <button className="linkbtn small" onClick={() => toCareer(MAJOR_GUIDE[u.major] ? u.major : u.major === "디자인(통합)" ? "시각디자인" : "기타")}>학과·진로 자세히 보기 →</button></div>
  </>;
}
