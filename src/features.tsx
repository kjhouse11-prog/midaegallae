// v0.9 기능 화면 — 개인 맞춤 입시 플래너 · 나만의 주간 체크리스트 · 입시 일정 · 나에게 맞는 학원 찾기 · 첨삭 비용 예시
import { useMemo, useState, type ReactNode } from "react";
import { REGIONS } from "./lib/data";
import type { AuthUser, Profile } from "./lib/store";
import * as S from "./lib/store";
import { ACADEMIES, ACADEMY_CHECKLIST, ACADEMY_SOURCES, fitAcademy, type AcademyPref } from "./lib/academies";
import { CRITIQUES, won, type CritiqueReq } from "./lib/critique";
import { GRADE_ROADMAP, SCHEDULE_2027, SCHEDULE_SOURCE, WEEKDAYS, dayDiff, defaultSettings, makeWeek, upcoming, weekStart, type Direction, type PlanSettings, type Task, type Week } from "./lib/planner";
import { NOW, gpaSystem, weakest, type Ctx } from "./lib/calc";
import { toGpa9, type Program } from "./lib/engine";
import { NumInput } from "./ui";

const fname = (f: string) => f.replace("(게임)", " (게임)");
const md = (iso: string) => { const [, m, d] = iso.split("-"); return `${+m}.${+d}`; };
const BetaNote = ({ children }: { children: ReactNode }) => <div className="beta-note" role="note"><b>베타 · 가상 예시</b> {children}</div>;

// ---------- 주간 체크리스트 저장 ----------
type Hist = { start: string; done: number; total: number }[];
export function useWeek(user: AuthUser) {
  const [week, setW] = useState<Week | null>(() => {
    const w = S.uget<Week | null>(user, "week", null); if (!w || w.start === weekStart(NOW)) return w;
    const h = S.uget<Hist>(user, "week-hist", []); S.uset(user, "week-hist", [{ start: w.start, done: w.tasks.filter((t) => t.done).length, total: w.tasks.length }, ...h.filter((x) => x.start !== w.start)].slice(0, 12));
    S.uset(user, "week", null); return null;
  });
  const setWeek = (w: Week | null) => { setW(w); S.uset(user, "week", w); };
  return [week, setWeek] as const;
}
export const weekDone = (w: Week | null) => (w ? `${w.tasks.filter((t) => t.done).length}/${w.tasks.length}` : "0/0");

// ---------- 플래너 탭 ----------
export type PlanSub = "plan" | "week" | "road" | "cal";
export function Planner({ user, ctx, target, road, sub, setSub, go }: { user: AuthUser; ctx: Ctx; target?: Program; road: ReactNode; sub: PlanSub; setSub: (s: PlanSub) => void; go: (t: string) => void }) {
  return <>
    <h1 className="page">입시 플래너</h1>
    <div className="seg" role="group" aria-label="플래너 메뉴">{([["plan", "맞춤 플래너"], ["week", "주간 체크"], ["road", "합격 로드맵"], ["cal", "입시 일정"]] as [PlanSub, string][]).map(([k, t]) =>
      <button key={k} aria-pressed={sub === k} onClick={() => setSub(k)}>{t}</button>)}</div>
    {sub === "plan" ? <PlanSetup user={user} ctx={ctx} target={target} go={go} toWeek={() => setSub("week")} /> : sub === "week" ? <WeekCheck user={user} ctx={ctx} target={target} go={go} /> : sub === "road" ? road : <Calendar grade={ctx.p.grade} />}
  </>;
}

function PlanSetup({ user, ctx, target, go, toWeek }: { user: AuthUser; ctx: Ctx; target?: Program; go: (t: string) => void; toWeek: () => void }) {
  const [s, setS] = useState<PlanSettings>(() => ({ ...defaultSettings(ctx.p.grade, NOW), ...S.uget<Partial<PlanSettings>>(user, "plan", {}) }));
  const [msg, setMsg] = useState("");
  const [week] = useWeek(user);
  const set = <K extends keyof PlanSettings>(k: K, v: PlanSettings[K]) => { setS((x) => ({ ...x, [k]: v })); setMsg(""); };
  const prac = Math.round(s.weeklyHours * s.practicalPct / 10) / 10, study = Math.round((s.weeklyHours - prac) * 10) / 10;
  const next = upcoming(NOW)[0]; const sys = gpaSystem(ctx.p);
  const save = () => { S.uset(user, "plan", s); setMsg("목표를 저장했어요. '주간 체크'에서 맞춤 계획을 만들어 보세요."); };
  return <>
    <p className="lead">학년·계열·분야·주간 시간에 맞춰 <b>연습 계획 예시</b>를 만들어요. 합격 가능성 판정은 '대학찾기', 대학별 일정은 각 대학 모집요강을 함께 확인하세요.</p>
    <div className="grid2">
      <div className="stat"><span className="k">나의 학년 · 분야</span><span className="v">{ctx.p.grade}</span><span className="tiny">{ctx.p.track} · {fname(ctx.p.field)}</span></div>
      <div className="stat"><span className="k">내신 (9등급 환산)</span><span className="v">{toGpa9(+ctx.p.gpa, sys).toFixed(1)}</span><span className="tiny">{sys}등급제 {ctx.p.gpa}등급</span></div>
      <div className="stat"><span className="k">주간 계획 완료</span><span className="v">{weekDone(week)}</span><span className="tiny">이번 주 체크리스트</span></div>
      <div className="stat"><span className="k">다음 입시 일정</span><span className="v">{next ? `D-${Math.max(0, dayDiff(next.start, NOW))}` : "–"}</span><span className="tiny">{next ? next.label.split(" (")[0] : "일정 없음"}</span></div>
    </div>
    <div className="card"><b>1. 나의 입시 목표</b>
      <label className="f">준비 방향<select value={s.direction} onChange={(e) => set("direction", e.target.value as Direction)}>{["수시 중심", "정시 중심", "수시·정시 병행"].map((d) => <option key={d}>{d}</option>)}</select></label>
      <div className="grid2">
        <label className="f">목표 학년도<select value={s.targetYear} onChange={(e) => set("targetYear", +e.target.value)}>{[0, 1, 2, 3].map((k) => <option key={k} value={2027 + k}>{2027 + k}학년도</option>)}</select></label>
        <label className="f">목표 대학·학과<input value={s.goal} placeholder={target ? `${target.univ} ${target.dept}` : "직접 입력"} onChange={(e) => set("goal", e.target.value)} /></label>
      </div>
      {target ? <span className="tiny">대학찾기에서 정한 목표: <b>{target.univ} {target.dept}</b> ({target.exam || "실기 없음"}{target.paper ? ` · ${target.paper}` : ""}) — 계획의 실전 연습에 반영돼요.</span> : <button type="button" className="linkbtn" onClick={() => go("match")}>대학찾기에서 목표 대학 정하기 →</button>}
    </div>
    <div className="card"><b>2. 주간 시간 배분</b>
      <div className="grid2">
        <label className="f">주간 입시 준비 시간<NumInput min={2} max={60} value={s.weeklyHours} onCommit={(v) => set("weeklyHours", v ?? 14)} /></label>
        <label className="f">주간 연습일 수<select value={s.practiceDays} onChange={(e) => set("practiceDays", +e.target.value)}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d}일</option>)}</select></label>
      </div>
      <label className="f"><span>실기 시간 비중 <b className="num">{s.practicalPct}%</b></span><input type="range" min={20} max={90} step={5} value={s.practicalPct} onChange={(e) => set("practicalPct", +e.target.value)} /></label>
      <div className="weights"><span className="w-p" style={{ width: `${s.practicalPct}%` }}>실기 {prac}시간</span><span className="w-g" style={{ width: `${100 - s.practicalPct}%` }}>내신·수능 {study}시간</span></div>
      <span className="f-label small">학원·연습 요일</span>
      <div className="daypick" role="group" aria-label="연습 요일">{WEEKDAYS.map((d) => <button type="button" key={d} aria-pressed={s.academyDays.includes(d)} onClick={() => set("academyDays", s.academyDays.includes(d) ? s.academyDays.filter((x) => x !== d) : [...s.academyDays, d])}>{d}</button>)}</div>
      <span className="tiny">비중은 내가 정하는 시간 배분이에요. 대학 전형의 실기·내신 반영 비율과는 달라요.</span>
      {msg && <div className="ok-msg">{msg}</div>}
      <div className="row" style={{ gap: 8 }}><button className="btn" onClick={save}>목표 저장</button><button className="btn ghost" onClick={() => { save(); toWeek(); }}>주간 체크리스트로 →</button></div>
    </div>
    <div className="card"><b>3. {ctx.p.grade} 연간 준비 흐름</b>
      {(GRADE_ROADMAP[ctx.p.grade] || []).map((r) => <div className="month" key={r.when}><span className="m">{r.when}</span><div className="small">{r.what}</div></div>)}
      <span className="tiny">「월간 미대입시」 합격수기·학원 커리큘럼을 바탕으로 정리한 일반적인 흐름이에요.</span>
    </div>
    <div className="card"><b>4. 내신·작품·대학·학원 연결</b>
      <div className="quick">
        <button onClick={() => go("me")}>내신 성적 입력</button><button onClick={() => go("works")}>작품 기록하기</button>
        <button onClick={() => go("match")}>관심 대학 확인</button><button onClick={() => go("acad")}>나에게 맞는 학원</button>
      </div>
      <span className="tiny">목표 대학: {target ? `${target.univ} ${target.dept}` : s.goal || "미설정"} · 올린 작품 {ctx.works.length}개 · 수상 {ctx.awards.length}건</span>
    </div>
  </>;
}

function WeekCheck({ user, ctx, target, go }: { user: AuthUser; ctx: Ctx; target?: Program; go: (t: string) => void }) {
  const [week, setWeek] = useWeek(user);
  const [confirm, setConfirm] = useState(false), [txt, setTxt] = useState(""), [day, setDay] = useState(WEEKDAYS[(NOW.getDay() + 6) % 7]);
  const hist = S.uget<Hist>(user, "week-hist", []);
  const s: PlanSettings = { ...defaultSettings(ctx.p.grade, NOW), ...S.uget<Partial<PlanSettings>>(user, "plan", {}) };
  function gen() {
    if (week && !confirm) { setConfirm(true); return; }
    const exam = target?.exam && !/없음|확인/.test(target.exam) ? `${target.exam.split("/")[0].trim()}${target.paper ? ` (${target.paper})` : ""}` : undefined;
    setWeek(makeWeek({ s, field: ctx.p.field, grade: ctx.p.grade, weak: weakest(ctx.works).map((x) => x[0]), targetExam: exam, targetName: target?.univ, now: NOW, seed: hist.length }));
    setConfirm(false);
  }
  const upd = (tasks: Task[]) => week && setWeek({ ...week, tasks });
  const toggle = (id: string) => week && upd(week.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const del = (id: string) => week && upd(week.tasks.filter((t) => t.id !== id));
  function add() { if (!txt.trim()) return; const w = week || { start: weekStart(NOW), tasks: [] }; setWeek({ ...w, tasks: [...w.tasks, { id: "c" + Date.now(), text: txt.trim(), cat: "직접 추가" as const, day, min: 0, done: false }].sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day)) }); setTxt(""); }
  const done = week ? week.tasks.filter((t) => t.done).length : 0, total = week?.tasks.length || 0;
  const mins = week ? week.tasks.reduce((a, t) => a + t.min, 0) : 0;
  return <>
    <div className="card"><div className="row between"><b>나만의 주간 체크리스트</b><button className="btn ghost" onClick={gen}>{confirm ? "한 번 더 누르면 교체" : "맞춤 계획 생성"}</button></div>
      <span className="tiny">주간 {s.weeklyHours}시간 · 실기 {s.practicalPct}% · 연습 {s.practiceDays}일 · {fname(ctx.p.field)}{target ? ` · 목표 ${target.univ}` : ""} 기준. 계획 생성은 이번 주 체크리스트를 새 계획으로 바꾸고 완료 기록을 지워요.</span>
      {week ? <>
        <div className="row between small"><span>{md(week.start)} 주 · 완료 <b className="num">{done}/{total}</b></span><span className="tiny">계획 {Math.round(mins / 6) / 10}시간</span></div>
        <div className="bar"><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
        <ul className="checks">{week.tasks.map((t) => <li key={t.id} className={t.done ? "done" : ""}>
          <label><input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} /><span className="dw">{t.day}</span><span className="tx">{t.text}<span className="tiny"> · {t.cat}{t.min ? ` · ${t.min}분` : ""}</span></span></label>
          <button aria-label={`${t.text} 삭제`} onClick={() => del(t.id)}>×</button></li>)}</ul>
        {total > 0 && done === total && <div className="ok-msg">이번 주 계획을 모두 끝냈어요! 완성작을 올려 진단을 받아 보세요.</div>}
      </> : <div className="empty">목표를 저장하고 '맞춤 계획 생성'을 눌러 주세요.</div>}
      <div className="addrow"><select aria-label="요일" value={day} onChange={(e) => setDay(e.target.value)}>{WEEKDAYS.map((d) => <option key={d}>{d}</option>)}</select>
        <input aria-label="할 일 직접 추가" placeholder="할 일 직접 추가" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /><button className="btn line" onClick={add}>추가</button></div>
    </div>
    {hist.length > 0 && <div className="card"><b>지난 주 기록</b>{hist.slice(0, 6).map((h) => <div className="row between small" key={h.start}><span>{md(h.start)} 주</span><span className="num">{h.done}/{h.total} ({h.total ? Math.round((h.done / h.total) * 100) : 0}%)</span></div>)}</div>}
    <div className="quick"><button onClick={() => go("works")}>작품 올리기</button><button onClick={() => go("acad")}>첨삭 비용 보기</button></div>
    <p className="tiny">체크리스트는 이 기기에 저장돼요. 매주 월요일에 새 주가 시작되고 지난 주 완료율은 기록으로 남아요.</p>
  </>;
}

function Calendar({ grade }: { grade: string }) {
  return <>
    <p className="lead">2027학년도 대입 주요 일정이에요{grade === "고3" || grade === "N수" ? "" : `. ${grade}은 해당 학년도 일정이 발표되면 같은 흐름으로 반영돼요`}.</p>
    <div className="card">{SCHEDULE_2027.map((e) => { const d = dayDiff(e.start, NOW), past = dayDiff(e.end || e.start, NOW) < 0; return (
      <div className={`ev${past ? " past" : ""}`} key={e.label}><span className={`chip k-${e.kind}`}>{e.kind}</span><div className="small"><b>{e.label}</b><br /><span className="tiny">{md(e.start)}{e.end ? ` ~ ${md(e.end)}` : ""}{e.start.startsWith("2027") ? " (2027)" : ""}</span></div>
        <span className="num small">{past ? "지남" : d <= 0 ? "진행 중" : `D-${d}`}</span></div>); })}
    </div>
    <p className="tiny">출처: <a href={SCHEDULE_SOURCE.url} target="_blank" rel="noopener">{SCHEDULE_SOURCE.name}</a>. 대학별 실기고사 날짜·시간은 모집요강으로 꼭 확인하세요.</p>
  </>;
}

// ---------- 학원 탭: 나에게 맞는 학원 찾기 · 첨삭 비용 ----------
export type AcadSub = "find" | "crit";
export function AcademyTab({ user, p, works, sub, setSub, go }: { user: AuthUser; p: Profile; works: { id: string; genre: string; madeOn: string }[]; sub: AcadSub; setSub: (s: AcadSub) => void; go: (t: string) => void }) {
  return <>
    <h1 className="page">{sub === "find" ? "입시미술학원 찾기" : "전문가 첨삭 · 비용"}</h1>
    <div className="seg" role="group" aria-label="학원 메뉴"><button aria-pressed={sub === "find"} onClick={() => setSub("find")}>나에게 맞는 학원</button><button aria-pressed={sub === "crit"} onClick={() => setSub("crit")}>첨삭 비용 예시</button></div>
    {sub === "find" ? <FindAcademy user={user} p={p} go={go} /> : <CritiqueView user={user} works={works} go={go} />}
  </>;
}

function FindAcademy({ user, p, go }: { user: AuthUser; p: Profile; go: (t: string) => void }) {
  const [pref, setPrefS] = useState<AcademyPref>(() => S.uget<AcademyPref>(user, "acad-pref", { budget: null, slot: "", gpaCare: false, oneOnOne: false }));
  const setPref = (x: Partial<AcademyPref>) => { const n = { ...pref, ...x }; setPrefS(n); S.uset(user, "acad-pref", n); };
  const [q, setQ] = useState(""), [reg, setReg] = useState("선호 지역"), [more, setMore] = useState(false), [onlyFav, setOnlyFav] = useState(false);
  const [fav, setFavS] = useState<string[]>(() => S.uget<string[]>(user, "acad-fav", []));
  const toggleFav = (id: string) => { const n = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id]; setFavS(n); S.uset(user, "acad-fav", n); };
  const [chk, setChkS] = useState<number[]>(() => S.uget<number[]>(user, "acad-check", []));
  const toggleChk = (k: number) => { const n = chk.includes(k) ? chk.filter((x) => x !== k) : [...chk, k]; setChkS(n); S.uset(user, "acad-check", n); };
  const [showChk, setShowChk] = useState(false);
  const regions = reg === "선호 지역" ? p.regions : reg === "전국" ? [] : [reg];
  const list = useMemo(() => {
    const qq = q.replace(/\s/g, "");
    return ACADEMIES.filter((a) => (!regions.length || regions.includes(a.region)) && (!qq || (a.name + a.area + a.region + a.fields.join("") + a.track).replace(/\s/g, "").includes(qq)) && (!onlyFav || fav.includes(a.id)))
      .map((a) => ({ a, f: fitAcademy(a, { grade: p.grade, track: p.track, field: p.field, regions: p.regions }, pref) })).sort((x, y) => y.f.score - x.f.score);
  }, [q, reg, pref, onlyFav, fav, p]);
  const shown = more ? list : list.slice(0, 8);
  return <>
    <BetaNote>아래 학원은 기능 시험용 <b>가상 학원</b>이에요(실제 학원 아님). 교습비도 예시 범위예요. 실제 학원은 맨 아래 공개 자료에서 찾고, 위치·비용·수업 시간은 직접 상담으로 확인하세요.</BetaNote>
    <div className="card"><b>나에게 맞는 학원 찾기</b>
      <span className="small">현재 프로필: <b>{p.grade} · {p.track.replace(" 계열", "")} · {fname(p.field)}</b> · 선호 지역 {p.regions.length ? p.regions.join("·") : "전국"}</span>
      <span className="tiny">희망 분야가 같은 학원을 먼저 보여 줘요. 분야 40 · 지역 25 · 예산 12 · 수업 시간 8 · 학년 5 · 내신 관리 5 · 1:1 첨삭 5점으로 맞춤도를 계산해요.</span>
      <div className="grid2">
        <label className="f"><span className="tiny">월 예산</span><select value={pref.budget ?? ""} onChange={(e) => setPref({ budget: e.target.value ? +e.target.value : null })}><option value="">제한 없음</option>{[40, 50, 60, 70, 80, 90, 110].map((b) => <option key={b} value={b}>{b}만 원 이하</option>)}</select></label>
        <label className="f"><span className="tiny">수업 시간</span><select value={pref.slot} onChange={(e) => setPref({ slot: e.target.value as AcademyPref["slot"] })}><option value="">상관없음</option>{["평일", "주말", "방학특강"].map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
        <label className="check"><input type="checkbox" checked={pref.gpaCare} onChange={(e) => setPref({ gpaCare: e.target.checked })} /><span>내신 관리 필요</span></label>
        <label className="check"><input type="checkbox" checked={pref.oneOnOne} onChange={(e) => setPref({ oneOnOne: e.target.checked })} /><span>1:1 첨삭 원함</span></label>
      </div>
      <div className="row" style={{ gap: 8 }}><button className="btn line" onClick={() => go("me")}>내 프로필 수정</button><button className="btn line" onClick={() => setShowChk(!showChk)}>학원 선택 체크리스트</button></div>
      {showChk && <ul className="checks">{ACADEMY_CHECKLIST.map((c, k) => <li key={k} className={chk.includes(k) ? "done" : ""}><label><input type="checkbox" checked={chk.includes(k)} onChange={() => toggleChk(k)} /><span className="tx small">{c}</span></label></li>)}</ul>}
    </div>
    <div className="card"><b>학원 검색</b>
      <input className="search" placeholder="학원명, 동네, 분야 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="학원 검색" />
      <div className="filters">
        <select aria-label="지역" value={reg} onChange={(e) => setReg(e.target.value)}><option>선호 지역</option><option>전국</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
        <select aria-label="보기" value={onlyFav ? "fav" : "all"} onChange={(e) => setOnlyFav(e.target.value === "fav")}><option value="all">모든 학원</option><option value="fav">관심 학원 ({fav.length})</option></select>
      </div>
      <span className="tiny">{list.length}곳 (가상 예시 {ACADEMIES.length}곳 중) · 맞춤도 순</span>
    </div>
    {shown.map(({ a, f }) => <div className="card acad" key={a.id}>
      <div className="row between"><span className="name">{a.name} <span className="chip plain">가상</span></span><span className={`fit ${f.score >= 80 ? "hi" : f.score >= 60 ? "mid" : ""}`}>{f.score}</span></div>
      <div className="small muted">{a.region} {a.area} · {a.track} · {a.grades.join("·")}</div>
      <div className="tags">{a.fields.map((x) => <span key={x} className={x === p.field ? "on" : ""}>{fname(x)}</span>)}</div>
      <dl className="kv"><dt>월 교습비</dt><dd><b className="num">{a.fee[0]}~{a.fee[1]}만 원</b> <span className="tiny">(정규반 예시)</span></dd><dt>수업</dt><dd>주 {a.hoursPerWeek}시간 · {a.slots.join("·")} · 반 {a.classSize}명 내외</dd>
        <dt>지원</dt><dd>{[a.gpaCare && "내신 관리", a.oneOnOne && "1:1 첨삭", a.contest && "실기대회 지도", a.online && "온라인 강평"].filter(Boolean).join(" · ") || "–"}</dd><dt>특징</dt><dd>{a.note}</dd></dl>
      <div className="row between tiny"><span>{f.why.length ? `✓ ${f.why.join(" · ")}` : ""}{f.miss.length ? <span className="miss"> {f.why.length ? "· " : ""}{f.miss.join(" · ")}</span> : null}</span>
        <button className="linkbtn" onClick={() => toggleFav(a.id)}>{fav.includes(a.id) ? "★ 관심" : "☆ 관심"}</button></div>
    </div>)}
    {!list.length && <div className="notice">조건에 맞는 학원이 없어요. 지역을 '전국'으로 바꾸거나 검색어를 지워 보세요.</div>}
    {list.length > 8 && <button className="btn line block" onClick={() => setMore(!more)}>{more ? "접기" : `${list.length - 8}곳 더 보기`}</button>}
    <div className="card"><b>전국 공개 자료로 실제 학원 찾기</b>
      {ACADEMY_SOURCES.map((s) => <a key={s.url} className="srclink" href={s.url} target="_blank" rel="noopener"><b className="small">{s.name}</b><span className="tiny">{s.note}</span></a>)}
      <span className="tiny">공개 목록은 학원의 현재 운영·수업·가격을 보증하지 않아요. 교습비는 학원 안에 게시된 금액과 교육청 등록 금액이 같은지 확인하세요.</span>
    </div>
  </>;
}

function CritiqueView({ user, works, go }: { user: AuthUser; works: { id: string; genre: string; madeOn: string }[]; go: (t: string) => void }) {
  const [reqs, setReqsS] = useState<CritiqueReq[]>(() => S.uget<CritiqueReq[]>(user, "critique", []));
  const setReqs = (r: CritiqueReq[]) => { setReqsS(r); S.uset(user, "critique", r); };
  const [open, setOpen] = useState<string | null>(null), [wid, setWid] = useState(""), [memo, setMemo] = useState(""), [msg, setMsg] = useState("");
  function order(svc: string) {
    const w = works.find((x) => x.id === wid);
    setReqs([{ id: Date.now().toString(36), svc, workId: w?.id, workLabel: w ? `${fname(w.genre)} (${w.madeOn})` : undefined, memo: memo.trim(), at: new Date().toISOString().slice(0, 10) }, ...reqs]);
    setOpen(null); setWid(""); setMemo(""); setMsg("신청 체험을 기록했어요. 실제 결제·전문가 연결은 되지 않아요.");
  }
  const total = reqs.reduce((a, r) => a + (CRITIQUES.find((c) => c.id === r.svc)?.price || 0), 0);
  return <>
    <BetaNote>실제 전문가 연결과 결제는 아직 되지 않아요. 아래는 서비스 흐름을 미리 보는 <b>가상 가격</b>이며, '신청 체험'을 눌러도 금액이 청구되지 않아요.</BetaNote>
    <div className="card"><b>비용 한눈에</b>
      <div className="costgrid">
        <div><span className="tiny">AI 진단</span><b className="num">무료</b></div>
        <div><span className="tiny">사진 첨삭 1회</span><b className="num">2만 원</b></div>
        <div><span className="tiny">화상 1:1 30분</span><b className="num">5만 원</b></div>
        <div><span className="tiny">학원 정규반 월 (예시)</span><b className="num">40~110만 원</b></div>
      </div>
      <span className="tiny">AI 진단으로 약점을 먼저 찾고, 꼭 필요한 작품만 전문가 첨삭을 받으면 비용을 줄일 수 있어요.</span>
    </div>
    {msg && <div className="ok-msg">{msg}</div>}
    {CRITIQUES.map((c) => <div className="card crit" key={c.id}>
      <div className="row between"><span><span className="chip plain">데모 상품</span>{c.tag && <span className="chip t-fit" style={{ marginLeft: 6 }}>{c.tag}</span>}</span><span className="tiny">{c.turnaround}</span></div>
      <b>{c.name}</b><span className="small muted">{c.who} · {c.how}</span>
      <ul className="list small">{c.detail.map((d) => <li key={d}>{d}</li>)}</ul>
      <div className="row between"><span><b className="num" style={{ fontSize: 20 }}>{won(c.price)}</b>{c.price ? <span className="tiny"> / {c.unit} (가상)</span> : null}</span>
        {c.id === "ai" ? <button className="btn ghost" onClick={() => go("works")}>작품 진단 받기</button> : <button className="btn ghost" onClick={() => { setOpen(open === c.id ? null : c.id); setMsg(""); }}>신청 체험</button>}</div>
      {open === c.id && <div className="order">
        <label className="f"><span className="tiny">첨삭받을 작품</span><select value={wid} onChange={(e) => setWid(e.target.value)}><option value="">{works.length ? "작품 선택 (선택 사항)" : "올린 작품이 없어요"}</option>{works.map((w) => <option key={w.id} value={w.id}>{fname(w.genre)} · {w.madeOn}</option>)}</select></label>
        <label className="f"><span className="tiny">요청 사항</span><input value={memo} placeholder="예: 구도가 답답해 보이는데 어떻게 풀까요?" onChange={(e) => setMemo(e.target.value)} /></label>
        <button className="btn block" onClick={() => order(c.id)}>{won(c.price)} 신청 체험 (결제 없음)</button>
      </div>}
    </div>)}
    <div className="card"><b>내 신청 체험 내역</b>
      {reqs.length ? <>{reqs.map((r) => { const c = CRITIQUES.find((x) => x.id === r.svc); return <div className="award" key={r.id}><span className="small">{c?.name} · {won(c?.price || 0)}<span className="tiny"><br />{r.at}{r.workLabel ? ` · ${r.workLabel}` : ""}{r.memo ? ` · "${r.memo}"` : ""} · 체험(결제 없음)</span></span>
        <button onClick={() => setReqs(reqs.filter((x) => x.id !== r.id))} aria-label="신청 체험 삭제">삭제</button></div>; })}
        <span className="tiny">체험 합계 {won(total)} (실제 청구 없음)</span></> : <div className="empty">신청 내역이 없어요.</div>}
    </div>
  </>;
}
