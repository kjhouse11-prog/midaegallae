import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DRILL, GENRES, MAJORS } from "./lib/data";
import * as S from "./lib/store";
import type { Artwork, Award, AuthUser, Profile } from "./lib/store";
import { NOW, academyMonths, buildPlan, demoAnalysis, examDate, gpaSystem, priorities, toStudent, weekTasks, workAvg, type Ctx } from "./lib/calc";
import { judge, practicalIndex, recommend, setUniverse, toGpa9, VERDICT_STYLE, type Judgement, type Program, type Verdict } from "./lib/engine";
import DATA from "./lib/programs.json";
import { Icon, InstallBar, NumInput, PartBar, Radar } from "./ui";
import { APP_VERSION } from "./config";

const PROGRAMS = DATA.programs as Program[];
setUniverse(PROGRAMS);
const byId = (id: string) => PROGRAMS.find((p) => p.id === id);
const fullName = (p: Program) => `${p.univ}${p.campus ? `(${p.campus})` : ""}`;
type Tab = "home" | "works" | "match" | "road" | "me";
const TARGET_KEY = "midae-navi-target-v4";
const VERDICTS: Verdict[] = ["안정", "적정", "소신", "상향"];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  useEffect(() => { S.currentUser().then((u) => { setUser(u); setBooting(false); }); return S.onAuthChange(setUser); }, []);
  if (booting) return <div className="app"><div className="loading">불러오는 중…</div></div>;
  return <div className="app">{S.isDemo && <div className="demo-bar">데모 모드 · 데이터는 이 기기에만 저장됩니다</div>}<InstallBar />{user ? <Main user={user} onSignOut={() => S.signOut().then(() => setUser(null))} /> : <Auth onDone={setUser} />}</div>;
}

// ---------------- 로그인 / 회원가입 ----------------
function Auth({ onDone }: { onDone: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [agree, setAgree] = useState(false), [age, setAge] = useState(false);
  const [err, setErr] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); setMsg("");
    if (mode === "up" && (!agree || !age)) { setErr("필수 동의 항목에 체크해 주세요."); return; }
    setBusy(true);
    try {
      if (mode === "up") { const r = await S.signUp(email.trim(), pw); if (r.needsConfirm) { setMsg("인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요."); setMode("in"); return; } }
      else await S.signIn(email.trim(), pw);
      const u = await S.currentUser(); if (u) onDone(u);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function reset() { setErr(""); setMsg(""); if (!email) { setErr("이메일을 먼저 입력해 주세요."); return; } try { await S.resetPassword(email.trim()); setMsg("비밀번호 재설정 메일을 보냈어요."); } catch (x) { setErr((x as Error).message); } }
  return (
    <form className="auth" onSubmit={submit}>
      <div className="hero" role="img" aria-label="산드로 보티첼리, 비너스의 탄생 부분">
        <div className="hero-txt"><span className="kicker">MONTHLY MIDAE IPSI · SINCE 1988</span><div className="logo">미대갈래</div><p>38년 미대 입시 데이터로 찾는<br />나의 미대 입시 길</p></div>
        <span className="credit">보티첼리 〈비너스의 탄생〉 1485년경 · 우피치 미술관</span>
      </div>
      <div className="seg" role="group"><button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>로그인</button><button type="button" aria-pressed={mode === "up"} onClick={() => setMode("up")}>회원가입</button></div>
      <label className="f">이메일<input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="f">비밀번호 {mode === "up" && <span className="tiny">(6자 이상)</span>}<input id="pw" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {mode === "up" && <>
        <label className="check"><input id="agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>(필수) 개인정보 수집·이용에 동의합니다. 내신·작품 등 입력 정보는 입시 진단에만 사용됩니다.</span></label>
        <label className="check"><input id="age" type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /><span>(필수) 만 14세 이상입니다. 만 14세 미만은 보호자 동의를 받은 뒤 가입해 주세요.</span></label>
      </>}
      {err && <div className="err" role="alert">{err}</div>}{msg && <div className="ok-msg">{msg}</div>}
      <button className="btn block" disabled={busy}>{busy ? <span className="spinner" /> : mode === "in" ? "로그인" : "가입하기"}</button>
      {mode === "in" && !S.isDemo && <button type="button" className="linkbtn" onClick={reset}>비밀번호를 잊으셨나요?</button>}
      <p className="tiny">버전 {APP_VERSION}</p>
    </form>
  );
}

// ---------------- 메인 ----------------
function Main({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("home");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [works, setWorks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true), [err, setErr] = useState("");
  const [target, setTargetState] = useState<string>(() => { try { return localStorage.getItem(TARGET_KEY) || ""; } catch { return ""; } });
  const [detail, setDetail] = useState<string | null>(null);
  const [workDetail, setWorkDetail] = useState<string | null>(null);
  const setTarget = (id: string) => { setTargetState(id); try { localStorage.setItem(TARGET_KEY, id); } catch { /* */ } };

  const reload = useCallback(async () => {
    try { const [p, a, w] = await Promise.all([S.loadProfile(user), S.listAwards(user), S.listArtworks(user)]); setProfile(p); setAwards(a); setWorks(w); setErr(""); }
    catch (x) { setErr((x as Error).message); } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { reload(); }, [reload]);
  const go = (t: Tab) => { setTab(t); setDetail(null); setWorkDetail(null); window.scrollTo(0, 0); };
  const open = (id: string) => { setTab("match"); setDetail(id); window.scrollTo(0, 0); };

  if (loading) return <div className="loading">불러오는 중…</div>;
  const needProfile = !profile || !profile.name;
  const p = profile || S.DEFAULT_PROFILE; const ctx: Ctx = { p, works, awards };
  const tp = target ? byId(target) : undefined;
  const view = needProfile && tab !== "me" ? <Onboard go={() => go("me")} /> :
    tab === "home" ? <Home ctx={ctx} target={tp} go={go} open={open} /> :
    tab === "works" ? <Works user={user} works={works} reload={reload} detail={workDetail} setDetail={setWorkDetail} /> :
    tab === "match" ? (detail && byId(detail) ? <ProgramView u={byId(detail)!} ctx={ctx} back={() => setDetail(null)} target={target} setTarget={setTarget} /> : <Match ctx={ctx} open={open} />) :
    tab === "road" ? <Road ctx={ctx} u={tp} go={go} /> :
    <Me user={user} profile={p} isNew={needProfile} awards={awards} reload={reload} onSignOut={onSignOut} />;
  return (
    <>
      <header className="top"><div className="brand"><b>미대갈래</b><span>by 월간 미대입시</span></div><span className="pill">베타 v{APP_VERSION}</span></header>
      <main id="view">{err && <div className="notice" role="alert">{err}</div>}{view}</main>
      <nav className="tabs" aria-label="주요 메뉴">
        {([["home", "홈"], ["works", "내 작품"], ["match", "대학찾기"], ["road", "로드맵"], ["me", "마이"]] as [Tab, string][]).map(([k, t]) =>
          <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}><Icon name={k} />{t}</button>)}
      </nav>
    </>
  );
}

function Onboard({ go }: { go: () => void }) {
  return <><h1 className="page">반가워요!<br />먼저 입시 프로필을 만들어요</h1><p className="lead">학교·학년·내신·학원 기간·수상 경력을 알려주면 전국 미술대학 {PROGRAMS.length}개 모집단위에서 내 위치를 판정해 드려요.</p><button className="btn block" onClick={go}>프로필 만들기</button></>;
}

const majorMatch = (p: Program, major: string) => p.major === major || (p.major === "디자인(통합)" && /디자인|미디어|공예/.test(major));
function DataBadge({ j }: { j: Judgement }) { return <span className="badge">{j.data}</span>; }

// ---------------- 홈 ----------------
function Home({ ctx, target, go, open }: { ctx: Ctx; target?: Program; go: (t: Tab) => void; open: (id: string) => void }) {
  const st = toStudent(ctx); const P = practicalIndex(st); const sys = gpaSystem(ctx.p);
  const pool = recommend(PROGRAMS, st).filter((x) => majorMatch(x.p, ctx.p.major));
  const cnt = Object.fromEntries(VERDICTS.map((v) => [v, pool.filter((x) => x.j.verdict === v).length])) as Record<Verdict, number>;
  const tj = target ? judge(target, st) : undefined;
  const left = target ? Math.ceil((examDate(ctx.p, target).getTime() - NOW.getTime()) / 864e5) : 0;
  return <>
    <h1 className="page">{ctx.p.name}님, {ctx.p.major} 입시를<br />함께 준비해요</h1>
    <div className="card hero">
      <div className="row between"><span className="small muted">{ctx.p.major} 관련 {pool.length}개 모집단위 판정</span><span className="tiny" style={{ color: "inherit", opacity: .8 }}>2026 입결 기준</span></div>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>{VERDICTS.map((k) => <div key={k}><div className="num" style={{ fontSize: 26 }}>{cnt[k]}</div><div className="small">{k}</div></div>)}</div>
      <button className="btn" style={{ background: "var(--accent-ink)", color: "var(--accent)" }} onClick={() => go("match")}>추천 대학 리스트 · 학과 판정</button>
    </div>
    <div className="grid2">
      <div className="stat"><span className="k">실기 지수{P.est ? " (추정)" : ""}</span><span className="v">{P.v}</span><span className="tiny">{P.est ? `학원 ${academyMonths(ctx.p)}개월 · 수상 ${ctx.awards.length}건으로 추정` : "작품 진단 반영"}</span></div>
      <div className="stat"><span className="k">내신 (9등급 환산)</span><span className="v">{toGpa9(+ctx.p.gpa, sys).toFixed(1)}</span><span className="tiny">{sys}등급제 {ctx.p.gpa}등급{ctx.p.school ? ` · ${ctx.p.school}` : ""}</span></div>
    </div>
    {target && tj && <><h2 className="sec">목표 대학</h2>
      <button className="card-btn" onClick={() => open(target.id)}><div className="card"><div className="row between"><b>{fullName(target)} {target.dept}</b><span className={`chip ${VERDICT_STYLE[tj.verdict].c}`}>{tj.verdict}</span></div>
        <div className="small muted">{target.track} · 실기까지 약 <b className="num">D-{left}</b> (예상)</div></div></button></>}
    <h2 className="sec">이번 주 할 일</h2>
    <div className="card"><ul className="list small">{weekTasks(ctx, target, tj).map((t) => <li key={t}>{t}</li>)}</ul></div>
    {!ctx.works.length && <button className="drop" onClick={() => go("works")}><b>첫 작품을 올려보세요</b><br /><span className="small">작품 진단 점수가 들어가면 실기 지수가 '추정'에서 '실측'으로 바뀌어 판정이 정확해져요</span></button>}
  </>;
}

// ---------------- 내 작품 ----------------
function Works({ user, works, reload, detail, setDetail }: { user: AuthUser; works: Artwork[]; reload: () => Promise<void>; detail: string | null; setDetail: (id: string | null) => void }) {
  const [genre, setGenre] = useState<string>(GENRES[0]); const [busy, setBusy] = useState(""), [err, setErr] = useState(""); const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function add(files: FileList | null) {
    if (!files?.length) return; setErr("");
    const list = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type)).slice(0, 6);
    if (!list.length) { setErr("JPG·PNG·WEBP 사진만 올릴 수 있어요."); return; }
    try { for (let i = 0; i < list.length; i++) { setBusy(`올리는 중… (${i + 1}/${list.length})`); await S.uploadArtwork(user, list[i], genre); } await reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  }
  const sel = works.find((w) => w.id === detail);
  if (sel) return <WorkView w={sel} back={() => setDetail(null)} reload={reload} />;
  return <>
    <h1 className="page">내 작품</h1><p className="lead">그림을 올리면 입시 실기 기준으로 분석해 드려요.</p>
    <label className={`drop${over ? " over" : ""}`} htmlFor="file" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
      {busy ? <><span className="spinner" /> {busy}</> : <><b>사진 올리기</b><br /><span className="small">작품 전체가 보이도록 정면에서 찍어 주세요</span></>}
    </label>
    <input ref={fileRef} type="file" id="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} disabled={!!busy} />
    <div className="row wrap"><span className="small muted">장르</span><select id="genre" className="chip plain" style={{ padding: "6px 10px" }} value={genre} onChange={(e) => setGenre(e.target.value)}>{GENRES.map((g) => <option key={g}>{g}</option>)}</select></div>
    {err && <div className="err" role="alert">{err}</div>}
    {works.length ? <div className="works">{works.map((w) => { const avg = workAvg(w.analysis); return (
      <button key={w.id} className="card-btn" onClick={() => setDetail(w.id)}><div className="work"><img src={w.url} alt={`${w.genre} 작품`} loading="lazy" />
        <div className="meta"><div className="row between"><b className="small">{w.genre}</b>{avg != null ? <span className="num small">{Math.round(avg)}점</span> : <span className="tiny">미분석</span>}</div><span className="tiny">{w.madeOn}</span></div></div></button>); })}</div>
      : <div className="notice">아직 올린 작품이 없어요. 최근 연습작 2~3점을 올려 보세요.</div>}
  </>;
}
function WorkView({ w, back, reload }: { w: Artwork; back: () => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [confirmDel, setConfirmDel] = useState(false); const a = w.analysis;
  async function analyze() { setBusy(true); setErr(""); try { await S.saveAnalysis(w, await demoAnalysis(w.url)); await reload(); } catch (x) { setErr("분석하지 못했어요: " + (x as Error).message); } finally { setBusy(false); } }
  async function del() { if (!confirmDel) { setConfirmDel(true); return; } try { await S.deleteArtwork(w); back(); await reload(); } catch (x) { setErr((x as Error).message); } }
  return <>
    <button className="back" onClick={back}>← 내 작품</button>
    <img src={w.url} alt={`${w.genre} 작품`} style={{ width: "100%", borderRadius: 16, border: "1px solid var(--line)", maxHeight: 420, objectFit: "contain", background: "var(--card)" }} />
    <div className="row between"><h1 className="page" style={{ fontSize: 20 }}>{w.genre}</h1><span className="tiny">{w.madeOn}</span></div>
    {a ? <>
      <div className="card"><div className="row between"><b>AI 실기 진단</b><span className={`chip ${a.model === "demo-stats" ? "plain" : "t-fit"}`}>{a.model === "demo-stats" ? "데모 분석" : "Claude 분석"}</span></div>
        <Radar scores={a.scores} /><div className="row between"><span className="muted small">평균</span><b className="num" style={{ fontSize: 22 }}>{Math.round(workAvg(a) || 0)}</b></div></div>
      <div className="card"><b>잘한 점</b><ul className="list small">{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul><b>보완할 점</b><ul className="list small">{a.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>
      <div className="card"><b>강사 코멘트</b><p className="small" style={{ margin: 0 }}>{a.comment}</p>{a.nextTask && <div className="notice"><b>다음 연습 과제</b> · {a.nextTask}</div>}</div>
      <p className="tiny">AI 참고 평가입니다. 실제 심사 결과와 다를 수 있어요.</p>
      <button className="btn line block" onClick={analyze} disabled={busy}>{busy ? <span className="spinner" /> : "다시 분석하기"}</button>
    </> : <div className="card"><b>아직 분석 전이에요</b><span className="small muted">구도·형태·명암·색채·완성도·발상 6개 항목으로 점수와 코멘트를 드려요. (현재 데모 분석 · Claude 분석은 다음 업데이트)</span>
      <button className="btn block" onClick={analyze} disabled={busy}>{busy ? <><span className="spinner" /> 분석 중…</> : "AI 진단 받기"}</button></div>}
    {err && <div className="err" role="alert">{err}</div>}
    <button className="btn line block" onClick={del}>{confirmDel ? "한 번 더 누르면 삭제됩니다" : "이 작품 삭제"}</button>
  </>;
}

// ---------------- 대학찾기: 추천 리스트 / 학과 판정 ----------------
const TT: [string, string, string[]][] = [["all", "전체", []], ["susi", "수시 실기", ["수시실기일괄", "수시실기다단계"]], ["hak", "수시 학종", ["수시학종"]], ["jung", "정시", ["정시실기", "정시비실기"]]];
const AREA: Record<string, string[]> = { 전국: [], 서울: ["서울"], "경기·인천": ["경기", "인천"], 지방: ["강원", "대전", "세종", "충북", "충남", "광주", "전북", "전남", "대구", "경북", "부산", "울산", "경남", "제주"] };
function Match({ ctx, open }: { ctx: Ctx; open: (id: string) => void }) {
  const [mode, setMode] = useState<"list" | "one">("list");
  const [tt, setTt] = useState("all"), [area, setArea] = useState("전국"), [mine, setMine] = useState(true), [vf, setVf] = useState<"전체" | Verdict>("전체");
  const st = useMemo(() => toStudent(ctx), [ctx]);
  const all = useMemo(() => recommend(PROGRAMS, st, { ttypes: TT.find((x) => x[0] === tt)![2], regions: AREA[area] }).filter((x) => !mine || majorMatch(x.p, ctx.p.major)), [st, tt, area, mine, ctx.p.major]);
  const list = vf === "전체" ? all : all.filter((x) => x.j.verdict === vf);
  return <>
    <h1 className="page">대학찾기</h1>
    <div className="seg" role="group" aria-label="보기"><button aria-pressed={mode === "list"} onClick={() => setMode("list")}>추천 대학 리스트</button><button aria-pressed={mode === "one"} onClick={() => setMode("one")}>특정 학과 판정</button></div>
    {mode === "one" ? <OneCheck ctx={ctx} open={open} /> : <>
      <p className="lead">내 내신·실기 지수·모의고사를 대학별 반영비율로 환산해 2026학년도 합격자와 비교했어요.</p>
      <div className="seg" role="group" aria-label="전형">{TT.map(([k, t]) => <button key={k} aria-pressed={tt === k} onClick={() => setTt(k)}>{t}</button>)}</div>
      <div className="filters">
        <select aria-label="지역" value={area} onChange={(e) => setArea(e.target.value)}>{Object.keys(AREA).map((a) => <option key={a}>{a}</option>)}</select>
        <select aria-label="전공" value={mine ? "mine" : "all"} onChange={(e) => setMine(e.target.value === "mine")}><option value="mine">{ctx.p.major} 관련만</option><option value="all">모든 전공</option></select>
        <select aria-label="판정" value={vf} onChange={(e) => setVf(e.target.value as "전체" | Verdict)}>{["전체", ...VERDICTS].map((v) => <option key={v}>{v}</option>)}</select>
      </div>
      <div className="tiny">{all.length}개 중 {list.length}개 · 안정 {all.filter((x) => x.j.verdict === "안정").length} · 적정 {all.filter((x) => x.j.verdict === "적정").length} · 소신 {all.filter((x) => x.j.verdict === "소신").length} · 상향 {all.filter((x) => x.j.verdict === "상향").length}</div>
      {list.length ? list.map(({ p, j }) => <button key={p.id} className="card-btn" onClick={() => open(p.id)}><div className="card uni">
        <div className="row between"><span className="name">{fullName(p)}</span><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{j.verdict}</span></div>
        <div className="small muted">{p.dept} · {p.track} · {p.region}</div>
        <div className="row between tiny"><span>{p.method}</span><DataBadge j={j} /></div></div></button>)
        : <div className="notice">이 조건에 맞는 모집단위가 없어요. 필터를 바꿔 보세요.</div>}
    </>}
    <p className="tiny">대학 데이터: {DATA.basis} · 조사 {DATA.asof}. 내신 입결은 대학 발표(학원 정리), 정시 수능 성적대는 학원 추정치예요. 실기 기준점은 경쟁률로 만든 추정치예요. 원서 전 반드시 대학 모집요강을 확인하세요.</p>
  </>;
}
function OneCheck({ ctx, open }: { ctx: Ctx; open: (id: string) => void }) {
  const unis = useMemo(() => [...new Set(PROGRAMS.map(fullName))].sort((a, b) => a.localeCompare(b, "ko")), []);
  const [q, setQ] = useState("");
  const hit = unis.filter((u) => q && u.replace(/\s/g, "").includes(q.replace(/\s/g, "")));
  const [uni, setUni] = useState<string | null>(null);
  const st = useMemo(() => toStudent(ctx), [ctx]);
  const rows = uni ? PROGRAMS.filter((p) => fullName(p) === uni).map((p) => ({ p, j: judge(p, st) })) : [];
  return <>
    <p className="lead">가고 싶은 대학을 검색하고 학과·전형을 고르면 지금 내 상황에서 가능한지 판정해 드려요.</p>
    <input className="search" placeholder="대학 이름 (예: 성신여대, 홍익대)" value={q} onChange={(e) => { setQ(e.target.value); setUni(null); }} aria-label="대학 검색" />
    {!uni && hit.length > 0 && <div className="plist">{hit.slice(0, 12).map((u) => <button key={u} className="pick" onClick={() => setUni(u)}><span>{u}</span><span className="tiny">{PROGRAMS.filter((p) => fullName(p) === u).length}개 전형</span></button>)}</div>}
    {q && !hit.length && <div className="notice">아직 수록되지 않은 대학이에요. 편집부가 전국 대학을 순서대로 입력하고 있어요.</div>}
    {uni && <><h2 className="sec">{uni} — 학과·전형 선택</h2><div className="plist">{rows.map(({ p, j }) =>
      <button key={p.id} className="pick" onClick={() => open(p.id)}><span><b className="small">{p.dept}</b><br /><span className="tiny">{p.track} · {p.method}</span></span><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{j.verdict}</span></button>)}</div></>}
  </>;
}
function ProgramView({ u, ctx, back, target, setTarget }: { u: Program; ctx: Ctx; back: () => void; target: string; setTarget: (id: string) => void }) {
  const st = toStudent(ctx); const j = judge(u, st); const pr = priorities(j).filter((x) => x.margin < 0);
  const tot = u.wP + u.wG + u.wC + u.wO || 1, pct = (x: number) => Math.round((x / tot) * 100);
  const g = (x: number | null) => (x == null ? "–" : x);
  return <>
    <button className="back" onClick={back}>← 목록</button>
    <div><h1 className="page">{fullName(u)}<br /><span style={{ fontSize: 18 }}>{u.dept}</span></h1><div className="small muted">{u.track} · {u.region}{u.quota ? ` · ${u.quota}명` : ""}{u.comp ? ` · 2026 경쟁률 ${u.comp}:1` : ""}</div></div>
    <div className="card"><div className="row between"><span className="small muted">지금 내 상황에서</span><DataBadge j={j} /></div>
      <div className="row between"><span className={`verdict`} style={{ color: `var(--${j.verdict === "상향" ? "reach" : j.verdict === "소신" ? "warn" : j.verdict === "적정" ? "good" : "accent"})` }}>{j.verdict}</span><span className="small muted">{VERDICT_STYLE[j.verdict].d}</span></div>
      {j.parts.map((x) => <PartBar key={x.k} k={x.k} w={pct(x.w)} mine={x.mine} need={x.need} margin={x.margin} />)}
    </div>
    <div className="card"><b>판정 근거</b><ul className="list small">{j.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      {j.warnings.length > 0 && <><b className="small">주의</b><ul className="warn-list small">{j.warnings.map((r) => <li key={r}>{r}</li>)}</ul></>}</div>
    {pr.length > 0 && <div className="card"><b>무엇을 먼저 올릴까</b><ul className="list small">{pr.map((x) => <li key={x.k}>{x.k === "실기" ? `실기: 지수 ${j.practical.v} → ${j.practical.req}. ${u.exam && !/없음|확인/.test(u.exam) ? `${u.exam} (${u.paper})` : "주력 종목"} 시간 재고 주 2회 완성, 작품을 올려 AI 진단 받기` : x.k === "내신" ? `내신: 기준 ${x.need}등급까지 올리기. 반영 교과는 ${u.gpa_subjects}` : `수능: 백분위 ${x.need} 목표. 반영 영역 ${u.csat_areas}`}</li>)}</ul></div>}
    <div className="card"><b>전형 정보 (2027학년도)</b>
      <div className="weights">{u.wP > 0 && <span className="w-p" style={{ width: `${pct(u.wP)}%` }}>실기 {pct(u.wP)}%</span>}{u.wG > 0 && <span className="w-g" style={{ width: `${pct(u.wG)}%` }}>{u.ttype === "수시학종" ? "서류" : "내신"} {pct(u.wG)}%</span>}{u.wC > 0 && <span className="w-c" style={{ width: `${pct(u.wC)}%` }}>수능 {pct(u.wC)}%</span>}{u.wO > 0 && <span className="w-c" style={{ width: `${pct(u.wO)}%`, opacity: .6 }}>면접 {pct(u.wO)}%</span>}</div>
      <dl className="kv"><dt>전형방법</dt><dd>{u.method}</dd>{u.stage1 && <><dt>1단계</dt><dd>{u.stage1}</dd></>}<dt>실기</dt><dd>{u.exam || "없음"}{u.paper ? ` · ${u.paper}` : ""}</dd>
        <dt>내신 반영</dt><dd>{u.gpa_subjects}</dd>{u.csat_min && <><dt>수능최저</dt><dd>{u.csat_min}</dd></>}{u.csat_areas && <><dt>수능 반영</dt><dd>{u.csat_areas}{u.eng ? ` · 영어 ${u.eng}등급대` : ""}</dd></>}{u.note && <><dt>비고</dt><dd>{u.note}</dd></>}</dl></div>
    <div className="card"><b>전년도(2026) 합격자 성적</b>
      {u.round === "수시" ? <dl className="kv"><dt>내신 최고</dt><dd className="num">{g(u.gpa_best)}</dd><dt>내신 평균</dt><dd className="num">{g(u.gpa_avg)}</dd><dt>70% 컷</dt><dd className="num">{g(u.gpa_cut70)}</dd><dt>최저</dt><dd className="num">{g(u.gpa_min)}</dd><dt>기준</dt><dd>{u.gpa_basis || "–"}</dd></dl>
        : <dl className="kv"><dt>수능 백분위</dt><dd className="num">{u.csat_pct == null ? "자료 없음" : `${u.csat_pct} ± ${u.csat_pm}`}</dd><dt>기준</dt><dd>학원 추정 합격 성적대 (공식 입결 아님)</dd></dl>}
      <span className="tiny">출처: {(DATA.sources as Record<string, string>)[u.src.split("·")[0]] || u.src} · 상태: {u.verify}</span></div>
    <div className="card"><b>합격자는 이렇게 준비했어요</b><span className="small muted">「미대입시」 합격수기·교수 심사평 데이터베이스를 연결하는 중이에요. 같은 학교 선배{ctx.p.school ? `(${ctx.p.school})` : ""} 합격 사례도 이곳에 보여 드릴 예정이에요.</span></div>
    <button className="btn block" onClick={() => setTarget(u.id)}>{target === u.id ? "목표 대학으로 설정됨 ✓" : "목표 대학으로 설정"}</button>
  </>;
}

// ---------------- 로드맵 ----------------
function Road({ ctx, u, go }: { ctx: Ctx; u?: Program; go: (t: Tab) => void }) {
  if (!u) return <><h1 className="page">합격 로드맵</h1><div className="notice">대학찾기에서 목표 대학을 먼저 정해 주세요.</div><button className="btn" onClick={() => go("match")}>대학찾기</button></>;
  const j = judge(u, toStudent(ctx)); const { months, weak, steps } = buildPlan(u, j, ctx); const w2 = weak.slice(0, 2);
  return <>
    <h1 className="page">합격 로드맵</h1>
    <div className="card"><div className="row between"><b>{fullName(u)} {u.dept}</b><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{j.verdict}</span></div><span className="small muted">{u.track} · 실기까지 약 {months}개월 (예상)</span></div>
    <h2 className="sec">무엇을 먼저 올릴까</h2>
    <div className="card">{priorities(j).map((g, i) => <div className="row between" key={g.k}><span><b>{i + 1}. {g.k}</b> <span className="tiny">반영 {Math.round((g.w / (u.wP + u.wG + u.wC + u.wO || 1)) * 100)}%</span></span><span className="small num">{g.mine} → {g.need} {g.margin < 0 ? <span style={{ color: "var(--reach)" }}>보완</span> : <span style={{ color: "var(--good)" }}>충족</span>}</span></div>)}
      <span className="tiny">반영비율 × 부족분이 큰 순서입니다.</span></div>
    {w2.length > 0 && <div className="card"><b>작품 분석에서 찾은 약점</b><span className="small">{w2.join(" · ")} — {DRILL[w2[0]]}</span></div>}
    <h2 className="sec">월별 계획</h2>
    <div className="card">{steps.map((m) => <div className="month" key={m.label}><span className="m">{m.label}</span><div className="small"><b>{m.title}</b>{m.items.map((x) => <div key={x}>{x}</div>)}</div></div>)}</div>
  </>;
}

// ---------------- 마이 ----------------
const LEVELS = ["대상", "금상", "은상", "동상", "장려상", "특선", "입선", "기타"], SCOPES = ["전국", "지역", "교내"];
function Me({ user, profile, isNew, awards, reload, onSignOut }: { user: AuthUser; profile: Profile; isNew: boolean; awards: Award[]; reload: () => Promise<void>; onSignOut: () => void }) {
  const [p, setP] = useState<Profile>(profile); const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [aw, setAw] = useState(""), [lv, setLv] = useState("장려상"), [sc, setSc] = useState("전국");
  const sys = p.grade === "고3" || p.grade === "N수" ? 9 : 5;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault(); setErr(""); setMsg(""); if (!p.name.trim()) { setErr("이름을 입력해 주세요."); return; }
    setBusy(true); try { await S.saveProfile(user, { ...p, name: p.name.trim(), school: p.school.trim(), gpa: Math.min(Math.max(p.gpa, 1), sys), mock: Math.min(Math.max(p.mock, 0), 100) }); await reload(); setMsg("저장했어요"); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function addAw(e: FormEvent) { e.preventDefault(); if (!aw.trim()) return; try { await S.addAward(user, `${aw.trim()} ${lv}`, `${sc}|${lv}`); setAw(""); await reload(); } catch (x) { setErr((x as Error).message); } }
  return <>
    <h1 className="page">{isNew ? "입시 프로필 만들기" : "내 입시 프로필"}</h1><p className="lead">{user.email}</p>
    <form className="card" onSubmit={save} autoComplete="off">
      <label className="f">이름<input id="pf-name" value={p.name} onChange={(e) => set("name", e.target.value)} required /></label>
      <div className="grid2">
        <label className="f">재학 고교<input id="pf-school" value={p.school} placeholder="예: 건국대학교부속고" onChange={(e) => set("school", e.target.value)} /></label>
        <label className="f">고교 유형<select id="pf-stype" value={p.schoolType} onChange={(e) => set("schoolType", e.target.value)}>{["일반고", "자율형사립고", "특목고", "예술고", "특성화고", "검정고시"].map((g) => <option key={g}>{g}</option>)}</select></label>
      </div>
      <div className="grid2">
        <label className="f">학년<select id="pf-grade" value={p.grade} onChange={(e) => set("grade", e.target.value as Profile["grade"])}>{["고1", "고2", "고3", "N수"].map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="f">희망 전공<select id="pf-major" value={p.major} onChange={(e) => set("major", e.target.value)}>{MAJORS.map((m) => <option key={m}>{m}</option>)}</select></label>
      </div>
      <div className="grid2">
        <label className="f"><span>내신 등급 <span className="tiny">({sys}등급제)</span></span><NumInput id="pf-gpa" min={1} max={sys} value={p.gpa} onCommit={(v) => set("gpa", v ?? 1)} placeholder={`1 ~ ${sys}`} /></label>
        <label className="f"><span>모의고사 평균 백분위</span><NumInput id="pf-mock" min={0} max={100} allowEmpty value={p.mockKnown ? p.mock : null} placeholder="모르면 비워두기" onCommit={(v) => { set("mockKnown", v !== null); set("mock", v ?? 0); }} /></label>
      </div>
      <label className="f">미술학원 시작 (연-월)<input id="pf-academy" type="month" value={p.academyStart} onChange={(e) => set("academyStart", e.target.value)} /></label>
      <span className="tiny">고1·고2는 5등급제, 고3·N수는 9등급제예요 (2028 대입개편). 대학 입결(9등급제)과 비교할 때는 같은 석차 비율로 환산해요. 학원 {academyMonths(p)}개월. 모의고사를 비우면 내신 수준으로 추정해요.</span>
      {err && <div className="err" role="alert">{err}</div>}{msg && <div className="ok-msg">{msg}</div>}
      <button className="btn block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : isNew ? "프로필 저장하고 시작하기" : "저장"}</button>
    </form>
    {!isNew && <div className="card"><b>수상 경력</b>
      <div className="awards">{awards.length ? awards.map((a) => <div className="award" key={a.id}><span>{a.title}{a.level ? <span className="tiny"> · {a.level.split("|")[0]}</span> : null}{a.verified ? " ✓" : ""}</span><button onClick={async () => { await S.deleteAward(a.id); await reload(); }} aria-label={`${a.title} 삭제`}>삭제</button></div>) : <span className="small muted">아직 없어요.</span>}</div>
      <form className="card" style={{ padding: 0, border: 0 }} onSubmit={addAw}><label className="f"><span className="tiny">대회명 · 연월</span><input id="aw-in" value={aw} onChange={(e) => setAw(e.target.value)} placeholder="예: 전국 미술실기대회 (2026.08)" /></label>
        <div className="grid2"><label className="f"><span className="tiny">상</span><select value={lv} onChange={(e) => setLv(e.target.value)}>{LEVELS.map((x) => <option key={x}>{x}</option>)}</select></label><label className="f"><span className="tiny">규모</span><select value={sc} onChange={(e) => setSc(e.target.value)}>{SCOPES.map((x) => <option key={x}>{x}</option>)}</select></label></div>
        <button className="btn line" type="submit">수상 추가</button></form>
      <span className="tiny">교외 수상은 학생부에 기재되지 않아 대입에 직접 반영되지 않아요. 앱은 실기 실력 추정에만 써요. 「미대입시」 주최 대회 수상은 앞으로 자동 인증됩니다.</span></div>}
    <button className="btn line block" onClick={onSignOut}>로그아웃</button>
    <p className="tiny">버전 {APP_VERSION}</p>
  </>;
}
