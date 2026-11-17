import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { IS_NATIVE, PLATFORM, WEB_URL, setBackHandler } from "./lib/native";
import { DRILL, FIELD_GROUPS, FIELDS, MAJORS, MAJOR_TRACK, REGIONS, REGION_GROUPS, SOLID_VIEWS, TRACKS, fieldGroup, fieldsOf, isSolidField } from "./lib/data";
import { AcademyTab, Planner, useWeek, weekDone, type AcadSub, type PlanSub } from "./features";
import { MentorTab, type MentorSub } from "./mentor";
import { dayDiff, nextEvent } from "./lib/planner";
import { BENEFITS, benefitFor } from "./lib/benefits";
import * as S from "./lib/store";
import type { Artwork, Award, AuthUser, Profile } from "./lib/store";
import { NOW, academyMonths, buildPlan, demoAnalysis, demoSolidAnalysis, examDate, gpaSystem, priorities, toStudent, weekTasks, workAvg, type Ctx } from "./lib/calc";
import { catOf, judge, majorMatch, practicalIndex, recommend, setUniverse, toGpa9, VERDICT_LABEL, VERDICT_STYLE, type Judgement, type Program, type Verdict } from "./lib/engine";
import DATA from "./lib/programs.json";
import { catLabel, TRACK_CATS, TRACK_DATA } from "./lib/strategy";
import { CareerPanel, ExamPanel, PassPrep } from "./career";
import { HomeTrackCard, StrategyPanel, UnivTracksCard, useTrackPref } from "./tracks";
import { AdBanner, Icon, InstallBar, NumInput, PartBar, Radar } from "./ui";
import { APP_VERSION } from "./config";

// 학과 카드(programs.json) + v0.11 전형 데이터(tracks.json)의 교과·종합·포트폴리오·추가 실기·정시 모집단위
const PROGRAMS = [...(DATA.programs as Program[]), ...TRACK_DATA.programs];
setUniverse(PROGRAMS);
const byId = (id: string) => PROGRAMS.find((p) => p.id === id);
const fullName = (p: Program) => `${p.univ}${p.campus ? `(${p.campus})` : ""}`;
type Tab = "home" | "works" | "match" | "plan" | "mentor" | "acad" | "me";
const TABS: [Tab, string][] = [["home", "홈"], ["works", "작품"], ["match", "대학찾기"], ["plan", "플래너"], ["mentor", "멘토"], ["acad", "학원"], ["me", "마이"]];
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
  const [mkt, setMkt] = useState(false), [ch, setCh] = useState<S.ConsentChannel[]>([]);
  const all = agree && age && mkt && ch.length === S.CONSENT_CHANNELS.length;
  function setAll(v: boolean) { setAgree(v); setAge(v); setMkt(v); setCh(v ? [...S.CONSENT_CHANNELS] : []); }
  const [err, setErr] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); setMsg("");
    if (mode === "up" && (!agree || !age)) { setErr("필수 동의 항목에 체크해 주세요."); return; }
    setBusy(true);
    try {
      const consent: S.Consent = { marketing: mkt, channels: mkt ? ch : [], at: new Date().toISOString(), ver: S.CONSENT_VER };
      if (mode === "up") { const r = await S.signUp(email.trim(), pw, consent); if (r.needsConfirm) { setMsg("인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요."); setMode("in"); return; } }
      else await S.signIn(email.trim(), pw);
      const u = await S.currentUser(); if (u && mode === "up") await S.saveConsent(u, consent).catch(() => {}); if (u) onDone(u);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function reset() { setErr(""); setMsg(""); if (!email) { setErr("이메일을 먼저 입력해 주세요."); return; } try { await S.resetPassword(email.trim()); setMsg("비밀번호 재설정 메일을 보냈어요."); } catch (x) { setErr((x as Error).message); } }
  return (
    <form className="auth" onSubmit={submit}>
      <div className="hero" role="img" aria-label="월간 미대입시, 꿈을 그리는 모든 순간 곁에 · Since 1988. 화실의 다비드 석고상과 소묘">
        <div className="art" aria-hidden="true" />
        <div className="hero-txt"><div className="logo">미대갈래</div><p>38년 미대 입시 데이터로 찾는<br />나의 미대 입시 길</p></div>
      </div>
      <div className="seg" role="group"><button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>로그인</button><button type="button" aria-pressed={mode === "up"} onClick={() => setMode("up")}>회원가입</button></div>
      <label className="f">이메일<input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="f">비밀번호 {mode === "up" && <span className="tiny">(6자 이상)</span>}<input id="pw" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {mode === "up" && <>
        <label className="check all"><input id="agree-all" type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /><b>전체 동의 (선택 항목 포함)</b></label>
        <label className="check"><input id="agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>(필수) 개인정보 수집·이용에 동의합니다. 내신·작품 등 입력 정보는 입시 진단에만 사용됩니다.</span></label>
        <label className="check"><input id="age" type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /><span>(필수) 만 14세 이상입니다. 만 14세 미만은 보호자 동의를 받은 뒤 가입해 주세요.</span></label>
        <ConsentBox mkt={mkt} setMkt={setMkt} ch={ch} setCh={setCh} />
      </>}
      {err && <div className="err" role="alert">{err}</div>}{msg && <div className="ok-msg">{msg}</div>}
      <button className="btn block" disabled={busy}>{busy ? <span className="spinner" /> : mode === "in" ? "로그인" : "가입하기"}</button>
      {mode === "in" && !S.isDemo && <button type="button" className="linkbtn" onClick={reset}>비밀번호를 잊으셨나요?</button>}
      <AdBanner />
      <p className="tiny">버전 {APP_VERSION}</p>
    </form>
  );
}

// (주)엠굿 마케팅 활용 동의 — 가입 화면과 마이 탭에서 같이 씀
function ConsentBox({ mkt, setMkt, ch, setCh }: { mkt: boolean; setMkt: (v: boolean) => void; ch: S.ConsentChannel[]; setCh: (v: S.ConsentChannel[]) => void }) {
  const T = S.CONSENT_TEXT;
  return <div className="consent">
    <label className="check"><input id="mkt" type="checkbox" checked={mkt} onChange={(e) => { setMkt(e.target.checked); setCh(e.target.checked ? (ch.length ? ch : [...S.CONSENT_CHANNELS]) : []); }} /><span>(선택) {T.company}의 사업 마케팅 활용에 동의합니다.</span></label>
    <details><summary className="tiny">내용 보기</summary>
      <table className="tbl tiny"><tbody>
        <tr><th>받는 곳</th><td>{T.company}</td></tr><tr><th>항목</th><td>{T.items}</td></tr>
        <tr><th>목적</th><td>{T.purpose}</td></tr><tr><th>보유 기간</th><td>{T.period}</td></tr>
      </tbody></table>
      <span className="tiny">동의하지 않아도 회원가입과 모든 기능을 이용할 수 있어요. 마이 탭에서 언제든 철회할 수 있고, 광고성 정보에는 (광고) 표시와 수신 거부 방법을 함께 안내해요. 동의는 2년마다 다시 확인해요.</span>
    </details>
    {mkt && <div className="daypick" role="group" aria-label="광고성 정보 받을 방법">{S.CONSENT_CHANNELS.map((c) => <button type="button" key={c} aria-pressed={ch.includes(c)} onClick={() => { const n = ch.includes(c) ? ch.filter((x) => x !== c) : [...ch, c]; setCh(n); if (!n.length) setMkt(false); }}>{c}</button>)}</div>}
  </div>;
}
function ConsentCard({ user }: { user: AuthUser }) {
  const [c, setC] = useState<S.Consent | null>(null), [mkt, setMkt] = useState(false), [ch, setCh] = useState<S.ConsentChannel[]>([]), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  useEffect(() => { S.loadConsent(user).then((x) => { setC(x); setMkt(!!x?.marketing); setCh(x?.channels || []); }).catch((x) => setErr((x as Error).message)); }, [user]);
  const dirty = mkt !== !!c?.marketing || ch.join() !== (c?.channels || []).join();
  async function save() {
    setErr(""); setMsg("");
    const at = new Date().toISOString(), n: S.Consent = mkt ? { marketing: true, channels: ch, at, ver: S.CONSENT_VER } : { marketing: false, channels: [], at: c?.at || at, ver: S.CONSENT_VER, withdrawnAt: at };
    try { await S.saveConsent(user, n); setC(n); setMsg(mkt ? "동의 내용을 저장했어요." : "마케팅 활용 동의를 철회했어요. 앞으로 광고성 정보를 보내지 않아요."); } catch (x) { setErr((x as Error).message); }
  }
  return <div className="card"><b>마케팅 활용 동의</b>
    <span className="small muted">{c?.marketing ? `동의함 · ${c.channels.join(", ")} · ${c.at.slice(0, 10)}` : c?.withdrawnAt ? `철회함 · ${c.withdrawnAt.slice(0, 10)}` : "동의하지 않음"}</span>
    {S.reconfirmDue(c) && <div className="notice">동의한 지 2년이 지났어요. 계속 소식을 받으시려면 아래에서 다시 저장해 주세요.</div>}
    <ConsentBox mkt={mkt} setMkt={setMkt} ch={ch} setCh={setCh} />
    {err && <div className="err" role="alert">{err}</div>}{msg && <div className="ok-msg">{msg}</div>}
    <button className="btn line block" disabled={!dirty && !S.reconfirmDue(c)} onClick={save}>저장</button>
  </div>;
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
  const [matchSub, setMatchSub] = useState<MatchSub>("list"), [careerMajor, setCareerMajor] = useState("");
  const [planSub, setPlanSub] = useState<PlanSub>("plan"), [acadSub, setAcadSub] = useState<AcadSub>("find"), [mentorSub, setMentorSub] = useState<MentorSub>("find");
  const setTarget = (id: string) => { setTargetState(id); try { localStorage.setItem(TARGET_KEY, id); } catch { /* */ } };

  const reload = useCallback(async () => {
    try { const [p, a, w] = await Promise.all([S.loadProfile(user), S.listAwards(user), S.listArtworks(user)]); setProfile(p); setAwards(a); setWorks(w); setErr(""); }
    catch (x) { setErr((x as Error).message); } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { reload(); }, [reload]);
  const go = (t: Tab, sub?: string) => {
    setTab(t); setDetail(null); setWorkDetail(null); window.scrollTo(0, 0);
    if (t === "match" && sub) setMatchSub(sub as MatchSub); if (t === "plan" && sub) setPlanSub(sub as PlanSub); if (t === "acad" && sub) setAcadSub(sub as AcadSub); if (t === "mentor" && sub) setMentorSub(sub as MentorSub);
  };
  const open = (id: string) => { setTab("match"); setDetail(id); window.scrollTo(0, 0); };
  // 안드로이드 뒤로 가기: 상세 → 목록, 다른 탭 → 홈, 홈에서는 앱 종료
  useEffect(() => {
    setBackHandler(() => { if (detail) { setDetail(null); return true; } if (workDetail) { setWorkDetail(null); return true; } if (tab !== "home") { go("home"); return true; } return false; });
    return () => setBackHandler(null);
  });

  if (loading) return <div className="loading">불러오는 중…</div>;
  const needProfile = !profile || !profile.name;
  const p = profile || S.DEFAULT_PROFILE; const ctx: Ctx = { p, works, awards };
  const tp = target ? byId(target) : undefined;
  const view = needProfile && tab !== "me" ? <Onboard go={() => go("me")} /> :
    tab === "home" ? <Home user={user} ctx={ctx} target={tp} go={go} open={open} /> :
    tab === "works" ? <Works user={user} works={works} reload={reload} detail={workDetail} setDetail={setWorkDetail} defaultField={p.field} /> :
    tab === "match" ? (detail && byId(detail) ? <ProgramView u={byId(detail)!} ctx={ctx} back={() => setDetail(null)} target={target} setTarget={setTarget} open={open} toCareer={(m) => { setCareerMajor(m); setMatchSub("career"); setDetail(null); window.scrollTo(0, 0); }} /> : <Match user={user} ctx={ctx} open={open} mode={matchSub} setMode={setMatchSub} career={careerMajor} setCareer={setCareerMajor} />) :
    tab === "plan" ? <Planner user={user} ctx={ctx} target={tp} road={<Road ctx={ctx} u={tp} go={go} />} sub={planSub} setSub={setPlanSub} go={(t) => go(t as Tab)} /> :
    tab === "mentor" ? <MentorTab user={user} p={p} works={works} sub={mentorSub} setSub={setMentorSub} /> :
    tab === "acad" ? <AcademyTab user={user} p={p} works={works} target={tp} sub={acadSub} setSub={setAcadSub} go={(t) => go(t as Tab)} /> :
    <Me user={user} profile={p} isNew={needProfile} awards={awards} reload={reload} onSignOut={onSignOut} />;
  return (
    <>
      <header className="top">
        <div className="top-row"><button className="brand" onClick={() => go("home")} aria-label="홈으로"><b>미대갈래</b><span>by 월간 미대입시</span></button><span className="pill">베타 v{APP_VERSION}</span></div>
        <nav className="topnav" aria-label="빠른 메뉴">
          {TABS.map(([k, t]) => <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>{t}</button>)}
        </nav>
      </header>
      <main id="view">{err && <div className="notice" role="alert">{err}</div>}{view}<AdBanner /></main>
      <nav className="tabs" aria-label="주요 메뉴">
        {TABS.map(([k, t]) => <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}><Icon name={k} />{t}</button>)}
      </nav>
    </>
  );
}

function Onboard({ go }: { go: () => void }) {
  return <><h1 className="page">반가워요!<br />먼저 입시 프로필을 만들어요</h1><p className="lead">학교·학년·내신·학원 기간·수상 경력을 알려주면 전국 미술대학 {PROGRAMS.length}개 모집단위에서 내 위치를 판정해 드려요.</p><button className="btn block" onClick={go}>프로필 만들기</button></>;
}

function DataBadge({ j }: { j: Judgement }) { return <span className="badge">{j.data}</span>; }

// ---------------- 홈 ----------------
function Home({ user, ctx, target, go, open }: { user: AuthUser; ctx: Ctx; target?: Program; go: (t: Tab, sub?: string) => void; open: (id: string) => void }) {
  const [week, setWeek] = useWeek(user); const next = nextEvent(NOW);
  const st = toStudent(ctx); const P = practicalIndex(st); const sys = gpaSystem(ctx.p);
  const pool = recommend(PROGRAMS, st).filter((x) => majorMatch(x.p, ctx.p.major));
  const cnt = Object.fromEntries(VERDICTS.map((v) => [v, pool.filter((x) => x.j.verdict === v).length])) as Record<Verdict, number>;
  const tj = target ? judge(target, st) : undefined;
  const left = target ? Math.ceil((examDate(ctx.p, target).getTime() - NOW.getTime()) / 864e5) : 0;
  return <>
    <h1 className="page">{ctx.p.name}님, {ctx.p.major} 입시를<br />함께 준비해요</h1>
    <div className="card hero">
      <div className="row between"><span className="small muted">{ctx.p.major} 관련 {pool.length}개 모집단위 판정</span><span className="tiny" style={{ color: "inherit", opacity: .8 }}>2026 입결 기준</span></div>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>{VERDICTS.map((k) => <div key={k}><div className="num" style={{ fontSize: 26 }}>{cnt[k]}</div><div className="small">{VERDICT_LABEL[k]}</div></div>)}</div>
      <button className="btn" style={{ background: "var(--accent-ink)", color: "var(--accent)" }} onClick={() => go("match")}>추천 대학 리스트 · 학과 판정</button>
    </div>
    <HomeTrackCard user={user} list={PROGRAMS} st={st} major={ctx.p.major} go={() => go("match", "strategy")} />
    <div className="grid2">
      <div className="stat"><span className="k">실기 지수{P.est ? " (추정)" : ""}</span><span className="v">{P.v}</span><span className="tiny">{P.est ? `학원 ${academyMonths(ctx.p)}개월 · 수상 ${ctx.awards.length}건으로 추정` : "작품 진단 반영"}</span></div>
      <div className="stat"><span className="k">내신 (9등급 환산)</span><span className="v">{toGpa9(+ctx.p.gpa, sys).toFixed(1)}</span><span className="tiny">{sys}등급제 {ctx.p.gpa}등급{ctx.p.school ? ` · ${ctx.p.school}` : ""}</span></div>
    </div>
    {target && tj && <><h2 className="sec">목표 대학</h2>
      <button className="card-btn" onClick={() => open(target.id)}><div className="card"><div className="row between"><b>{fullName(target)} {target.dept}</b><span className={`chip ${VERDICT_STYLE[tj.verdict].c}`}>{VERDICT_LABEL[tj.verdict]}</span></div>
        <div className="small muted">{target.track} · 실기까지 약 <b className="num">D-{left}</b> (예상)</div></div></button></>}
    <div className="quick4">
      <button onClick={() => go("acad", "find")}><span className="qi">🏫</span>나에게 맞는<br />학원 찾기</button>
      <button onClick={() => go("plan", "plan")}><span className="qi">🎯</span>개인 맞춤<br />입시 플래너</button>
      <button onClick={() => go("plan", "week")}><span className="qi">✅</span>주간 체크<br /><b className="num">{weekDone(week)}</b></button>
      <button onClick={() => go("mentor", "find")}><span className="qi">🎓</span>미대 선배<br />1:1 조언</button>
    </div>
    <button className="card-btn" onClick={() => go("mentor", "find")}><div className="card mentor-cta"><span className="chip t-fit" style={{ alignSelf: "flex-start" }}>NEW · 인증 선배 매칭</span><b>합격한 미대 선배에게 1:1로 물어보세요</b><span className="small muted">서류·면접·포트폴리오·학생부·실기 · 작은 조언 5천 원부터 · 결제금은 조언 확정 후 전달</span></div></button>
    {next && <button className="card-btn" onClick={() => go("plan", "cal")}><div className="card row between"><span className="small"><b>다음 입시 일정</b><br /><span className="muted">{next.label}</span></span><b className="num" style={{ fontSize: 22, color: "var(--accent)" }}>{dayDiff(next.start, NOW) <= 0 ? "진행 중" : `D-${dayDiff(next.start, NOW)}`}</b></div></button>}
    <h2 className="sec">이번 주 할 일</h2>
    {week && week.tasks.length ? <div className="card"><ul className="checks">{week.tasks.filter((t) => !t.done).slice(0, 4).map((t) => <li key={t.id}><label><input type="checkbox" onChange={() => setWeek({ ...week, tasks: week.tasks.map((x) => (x.id === t.id ? { ...x, done: true } : x)) })} /><span className="dw">{t.day}</span><span className="tx small">{t.text}</span></label></li>)}</ul>
      <button className="linkbtn" onClick={() => go("plan", "week")}>주간 체크리스트 전체 보기 ({weekDone(week)}) →</button></div>
      : <div className="card"><ul className="list small">{weekTasks(ctx, target, tj).map((t) => <li key={t}>{t}</li>)}</ul><button className="linkbtn" onClick={() => go("plan", "week")}>나만의 주간 체크리스트 만들기 →</button></div>}
    {!ctx.works.length && <button className="drop" onClick={() => go("works")}><b>첫 작품을 올려보세요</b><br /><span className="small">작품 진단 점수가 들어가면 실기 지수가 '추정'에서 '실측'으로 바뀌어 판정이 정확해져요</span></button>}
  </>;
}

// ---------------- 내 작품 ----------------
function Works({ user, works, reload, detail, setDetail, defaultField }: { user: AuthUser; works: Artwork[]; reload: () => Promise<void>; detail: string | null; setDetail: (id: string | null) => void; defaultField: string }) {
  const [field, setField] = useState<string>(FIELDS.includes(defaultField) ? defaultField : FIELDS[0]); const [busy, setBusy] = useState(""), [err, setErr] = useState(""); const [over, setOver] = useState(false);
  const [sides, setSides] = useState<(File | null)[]>(() => SOLID_VIEWS.map(() => null));
  const fileRef = useRef<HTMLInputElement>(null);
  const solid = isSolidField(field);
  const okType = (f: File) => /^image\/(jpeg|png|webp)$/.test(f.type);
  const previews = useMemo(() => sides.map((f) => (f ? URL.createObjectURL(f) : "")), [sides]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);
  async function add(files: FileList | null) {
    if (!files?.length) return; setErr("");
    const list = [...files].filter(okType).slice(0, 6);
    if (!list.length) { setErr("JPG·PNG·WEBP 사진만 올릴 수 있어요."); return; }
    try { for (let i = 0; i < list.length; i++) { setBusy(`올리는 중… (${i + 1}/${list.length})`); await S.uploadArtwork(user, list[i], field); } await reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  }
  function pickSide(k: number, files: FileList | null) {
    setErr(""); const f = files?.[0]; if (!f) return;
    if (!okType(f)) { setErr("JPG·PNG·WEBP 사진만 올릴 수 있어요."); return; }
    setSides((s) => s.map((x, i) => (i === k ? f : x)));
  }
  async function addSolid() {
    if (sides.some((f) => !f)) { setErr("앞·뒤·좌·우 4면 사진을 모두 넣어 주세요."); return; }
    setErr(""); setBusy("4면 사진 올리는 중…");
    try { await S.uploadSolidArtwork(user, sides as File[], field); setSides(SOLID_VIEWS.map(() => null)); await reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(""); }
  }
  const sel = works.find((w) => w.id === detail);
  if (sel) return <WorkView w={sel} back={() => setDetail(null)} reload={reload} />;
  return <>
    <h1 className="page">내 작품</h1><p className="lead">그림을 올리면 입시 실기 기준으로 분석해 드려요.</p>
    <label className="f">분야
      <select id="field" value={field} onChange={(e) => { setField(e.target.value); setErr(""); }}>
        {FIELD_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.fields.map((f) => <option key={f} value={f}>{f.replace("(게임)", "")}{g.solid ? " (4면 촬영)" : ""}</option>)}</optgroup>)}
      </select>
    </label>
    {solid ? <>
      <div className="notice small"><b>입체 작품은 4면 사진으로 올려요</b><br />작품을 같은 거리·같은 높이에서 앞·뒤·좌·우로 돌려 가며 찍어 주세요. 사진만으로는 양감·무게감·재료의 질감이 충분히 드러나지 않아, 조형·공예 계열 진단은 <b>참고용</b>이에요. 정확한 평가는 학원 선생님의 실물 확인을 함께 받으세요.</div>
      <div className="sides">{SOLID_VIEWS.map(([key, label], k) => <label key={key} className={`side${sides[k] ? " has" : ""}`} htmlFor={`side-${key}`}>
        {previews[k] ? <img src={previews[k]} alt={`${label}면 미리보기`} /> : <span className="plus">+</span>}
        <span className="side-l">{label}</span>
        <input id={`side-${key}`} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={!!busy} onChange={(e) => { pickSide(k, e.target.files); e.target.value = ""; }} />
      </label>)}</div>
      <button className="btn block" onClick={addSolid} disabled={!!busy || sides.some((f) => !f)}>{busy ? <><span className="spinner" /> {busy}</> : `4면 작품 올리기 (${sides.filter(Boolean).length}/4)`}</button>
    </> : <>
      <label className={`drop${over ? " over" : ""}`} htmlFor="file" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        {busy ? <><span className="spinner" /> {busy}</> : <><b>사진 올리기</b><br /><span className="small">작품 전체가 보이도록 정면에서 찍어 주세요</span></>}
      </label>
      <input ref={fileRef} type="file" id="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} disabled={!!busy} />
    </>}
    {err && <div className="err" role="alert">{err}</div>}
    {works.length ? <div className="works">{works.map((w) => { const avg = workAvg(w.analysis); return (
      <button key={w.id} className="card-btn" onClick={() => setDetail(w.id)}><div className="work"><img src={w.url} alt={`${fieldName(w.genre)} 작품`} loading="lazy" />{w.views?.length ? <span className="pill four">4면</span> : null}
        <div className="meta"><div className="row between"><b className="small">{fieldName(w.genre)}</b>{avg != null ? <span className="num small">{Math.round(avg)}점</span> : <span className="tiny">미분석</span>}</div><span className="tiny">{fieldGroup(w.genre) || "분야"} · {w.madeOn}</span></div></div></button>); })}</div>
      : <div className="notice">아직 올린 작품이 없어요. 최근 연습작 2~3점을 올려 보세요.</div>}
  </>;
}
const fieldName = (f: string) => f.replace("(게임)", " (게임)");
function WorkView({ w, back, reload }: { w: Artwork; back: () => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [confirmDel, setConfirmDel] = useState(false); const a = w.analysis;
  const [side, setSide] = useState(0); const views = w.views?.length ? w.views : null; const shown = views ? views[side]?.url || w.url : w.url;
  async function analyze() { setBusy(true); setErr(""); try { await S.saveAnalysis(w, views ? await demoSolidAnalysis(views.map((v) => v.url)) : await demoAnalysis(w.url)); await reload(); } catch (x) { setErr("분석하지 못했어요: " + (x as Error).message); } finally { setBusy(false); } }
  async function del() { if (!confirmDel) { setConfirmDel(true); return; } try { await S.deleteArtwork(w); back(); await reload(); } catch (x) { setErr((x as Error).message); } }
  return <>
    <button className="back" onClick={back}>← 내 작품</button>
    <img src={shown} alt={`${fieldName(w.genre)} 작품${views ? ` ${views[side].label}면` : ""}`} style={{ width: "100%", borderRadius: 16, border: "1px solid var(--line)", maxHeight: 420, objectFit: "contain", background: "var(--card)" }} />
    {views && <div className="seg" role="group" aria-label="보는 면">{views.map((v, k) => <button key={v.key} aria-pressed={side === k} onClick={() => setSide(k)}>{v.label}</button>)}</div>}
    <div className="row between"><h1 className="page" style={{ fontSize: 20 }}>{fieldName(w.genre)}</h1><span className="tiny">{fieldGroup(w.genre) ? `${fieldGroup(w.genre)} · ` : ""}{w.madeOn}</span></div>
    {a ? <>
      <div className="card"><div className="row between"><b>AI 실기 진단</b><span className={`chip ${a.model === "demo-stats" ? "plain" : "t-fit"}`}>{a.model === "demo-stats" ? "데모 분석" : "Claude 분석"}</span></div>
        <Radar scores={a.scores} /><div className="row between"><span className="muted small">평균</span><b className="num" style={{ fontSize: 22 }}>{Math.round(workAvg(a) || 0)}</b></div></div>
      <div className="card"><b>잘한 점</b><ul className="list small">{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul><b>보완할 점</b><ul className="list small">{a.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>
      <div className="card"><b>강사 코멘트</b><p className="small" style={{ margin: 0 }}>{a.comment}</p>{a.nextTask && <div className="notice"><b>다음 연습 과제</b> · {a.nextTask}</div>}</div>
      <p className="tiny">AI 참고 평가입니다. 실제 심사 결과와 다를 수 있어요.{views ? " 입체 작품은 사진 4면으로만 본 결과라 양감·공간감 평가에 한계가 있어요." : ""}</p>
      <button className="btn line block" onClick={analyze} disabled={busy}>{busy ? <span className="spinner" /> : "다시 분석하기"}</button>
    </> : <div className="card"><b>아직 분석 전이에요</b><span className="small muted">{views ? "앞·뒤·좌·우 4면을 각각 보고 평균 내요. " : ""}구도·형태·명암·색채·완성도·발상 6개 항목으로 점수와 코멘트를 드려요. (현재 데모 분석 · Claude 분석은 다음 업데이트)</span>
      <button className="btn block" onClick={analyze} disabled={busy}>{busy ? <><span className="spinner" /> 분석 중…</> : "AI 진단 받기"}</button></div>}
    {err && <div className="err" role="alert">{err}</div>}
    <button className="btn line block" onClick={del}>{confirmDel ? "한 번 더 누르면 삭제됩니다" : "이 작품 삭제"}</button>
  </>;
}

// ---------------- 대학찾기: 추천 리스트 / 학과 판정 ----------------
// 전형 필터: 전체 · 관심 전형 · 교과 · 종합 · 실기 · 포트폴리오 · 면접 · 정시
type MatchSub = "list" | "strategy" | "career" | "exam" | "one";
const TT: [string, string][] = [["all", "전체"], ["pref", "관심 전형"], ...TRACK_CATS.map((c) => [c.k, c.label] as [string, string])];
const AREA: Record<string, string[]> = { "선호 지역": [], 전국: [], 서울: ["서울"], "경기·인천": ["경기", "인천"], 지방: ["강원", "대전", "세종", "충북", "충남", "광주", "전북", "전남", "대구", "경북", "부산", "울산", "경남", "제주"] };
const MATCH_SUBS: [MatchSub, string][] = [["list", "추천"], ["strategy", "전형 전략"], ["career", "학과·진로"], ["exam", "실기 종목"], ["one", "대학 판정"]];
function Match({ user, ctx, open, mode, setMode, career, setCareer }: { user: AuthUser; ctx: Ctx; open: (id: string) => void; mode: MatchSub; setMode: (m: MatchSub) => void; career: string; setCareer: (m: string) => void }) {
  const [pref] = useTrackPref(user);
  const [tt, setTt] = useState(pref.length ? "pref" : "all"), [area, setArea] = useState(ctx.p.regions.length ? "선호 지역" : "전국"), [mine, setMine] = useState(true), [vf, setVf] = useState<"전체" | Verdict>("전체");
  const st = useMemo(() => toStudent(ctx), [ctx]);
  const cats = tt === "all" ? [] : tt === "pref" ? pref : [tt];
  const regions = area === "선호 지역" ? ctx.p.regions : AREA[area];
  const all = useMemo(() => recommend(PROGRAMS, st, { cats, regions }).filter((x) => !mine || majorMatch(x.p, ctx.p.major)), [st, cats.join(), area, mine, ctx.p.major]);
  const list = vf === "전체" ? all : all.filter((x) => x.j.verdict === vf);
  return <>
    <h1 className="page">대학찾기</h1>
    <div className="seg" role="group" aria-label="보기">{MATCH_SUBS.map(([k, t]) => <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{t}</button>)}</div>
    {mode === "one" ? <OneCheck ctx={ctx} open={open} /> : mode === "career" ? <CareerPanel list={PROGRAMS} st={st} open={open} fullName={fullName} major={career || ctx.p.major} setMajor={setCareer} /> : mode === "exam" ? <ExamPanel list={PROGRAMS} st={st} open={open} fullName={fullName} major={ctx.p.major} field={ctx.p.field} /> : mode === "strategy" ? <StrategyPanel user={user} list={PROGRAMS} st={st} major={mine ? ctx.p.major : undefined} regions={regions} open={open} fullName={fullName} /> : <>
      <p className="lead">내 내신·실기 지수·모의고사를 대학별 반영비율로 환산해 2026학년도 합격자와 비교했어요.</p>
      <div className="tags pick" role="group" aria-label="전형">{TT.filter(([k]) => k !== "pref" || pref.length).map(([k, t]) => <button key={k} aria-pressed={tt === k} onClick={() => setTt(k)}>{t}</button>)}</div>
      {tt === "pref" && <span className="tiny">관심 전형: {pref.map(catLabel).join(" · ")} — 전형별 전략에서 바꿀 수 있어요</span>}
      <div className="filters">
        <select aria-label="지역" value={area} onChange={(e) => setArea(e.target.value)}>{Object.keys(AREA).filter((a) => a !== "선호 지역" || ctx.p.regions.length).map((a) => <option key={a}>{a}</option>)}</select>
        <select aria-label="전공" value={mine ? "mine" : "all"} onChange={(e) => setMine(e.target.value === "mine")}><option value="mine">{ctx.p.major} 관련만</option><option value="all">모든 전공</option></select>
        <select aria-label="판정" value={vf} onChange={(e) => setVf(e.target.value as "전체" | Verdict)}>{["전체", ...VERDICTS].map((v) => <option key={v} value={v}>{v === "전체" ? v : VERDICT_LABEL[v as Verdict]}</option>)}</select>
      </div>
      <div className="tiny">{all.length}개 중 {list.length}개 · 하향(안정) {all.filter((x) => x.j.verdict === "안정").length} · 적정 {all.filter((x) => x.j.verdict === "적정").length} · 소신 {all.filter((x) => x.j.verdict === "소신").length} · 상향 {all.filter((x) => x.j.verdict === "상향").length}</div>
      {list.length ? list.map(({ p, j }) => <button key={p.id} className="card-btn" onClick={() => open(p.id)}><div className="card uni">
        <div className="row between"><span className="name">{fullName(p)}</span><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{VERDICT_LABEL[j.verdict]}</span></div>
        <div className="small muted">{p.dept} · {catLabel(catOf(p))}{p.round === "수시" && (p.itv ?? /면접/.test(p.method)) ? "+면접" : ""} · {p.track} · {p.region}</div>
        <div className="row between tiny"><span>{p.method}</span><DataBadge j={j} /></div></div></button>)
        : <div className="notice">이 조건에 맞는 모집단위가 없어요. 필터를 바꿔 보세요.</div>}
    </>}
    <p className="tiny">대학 데이터: {DATA.basis} · 조사 {DATA.asof} / 전형·모집인원: {TRACK_DATA.basis}. 내신 입결은 대학 발표(학원 정리), 정시 수능 성적대는 학원 추정치예요. 실기 기준점은 경쟁률로 만든 추정치예요. 원서 전 반드시 대학 모집요강을 확인하세요.</p>
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
    {uni && <UnivTracksCard ukey={uni} st={st} byId={byId} open={open} />}
    {uni && <><h2 className="sec">{uni} — 학과·전형 선택</h2><div className="plist">{rows.map(({ p, j }) =>
      <button key={p.id} className="pick" onClick={() => open(p.id)}><span><b className="small">{p.dept}</b><br /><span className="tiny">{p.track} · {p.method}</span></span><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{VERDICT_LABEL[j.verdict]}</span></button>)}</div></>}
  </>;
}
function ProgramView({ u, ctx, back, target, setTarget, open, toCareer }: { u: Program; ctx: Ctx; back: () => void; target: string; setTarget: (id: string) => void; open: (id: string) => void; toCareer: (major: string) => void }) {
  const st = toStudent(ctx); const j = judge(u, st); const pr = priorities(j).filter((x) => x.margin < 0);
  const tot = u.wP + u.wG + u.wC + u.wO || 1, pct = (x: number) => Math.round((x / tot) * 100);
  const g = (x: number | null) => (x == null ? "–" : x);
  return <>
    <button className="back" onClick={back}>← 목록</button>
    <div><h1 className="page">{fullName(u)}<br /><span style={{ fontSize: 18 }}>{u.dept}</span></h1><div className="small muted">{u.track} · {u.region}{u.quota ? ` · ${u.quota}명` : ""}{u.comp ? ` · 2026 경쟁률 ${u.comp}:1` : ""}</div></div>
    <div className="card"><div className="row between"><span className="small muted">지금 내 상황에서</span><DataBadge j={j} /></div>
      <div className="row between"><span className={`verdict`} style={{ color: `var(--${j.verdict === "상향" ? "reach" : j.verdict === "소신" ? "warn" : j.verdict === "적정" ? "good" : "accent"})` }}>{VERDICT_LABEL[j.verdict]}</span><span className="small muted">{VERDICT_STYLE[j.verdict].d}</span></div>
      {j.parts.map((x) => <PartBar key={x.k} k={x.k} w={pct(x.w)} mine={x.mine} need={x.need} margin={x.margin} />)}
    </div>
    <div className="card"><b>판정 근거</b><ul className="list small">{j.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      {j.warnings.length > 0 && <><b className="small">주의</b><ul className="warn-list small">{j.warnings.map((r) => <li key={r}>{r}</li>)}</ul></>}</div>
    {pr.length > 0 && <div className="card"><b>무엇을 먼저 올릴까</b><ul className="list small">{pr.map((x) => <li key={x.k}>{x.k === "실기" ? `실기: 지수 ${j.practical.v} → ${j.practical.req}. ${u.exam && !/없음|확인/.test(u.exam) ? `${u.exam} (${u.paper})` : "주력 종목"} 시간 재고 주 2회 완성, 작품을 올려 AI 진단 받기` : x.k === "내신" ? `내신: 기준 ${x.need}등급까지 올리기. 반영 교과는 ${u.gpa_subjects}` : `수능: 백분위 ${x.need} 목표. 반영 영역 ${u.csat_areas}`}</li>)}</ul></div>}
    <div className="card"><b>전형 정보 (2027학년도)</b>
      <div className="weights">{u.wP > 0 && <span className="w-p" style={{ width: `${pct(u.wP)}%` }}>실기 {pct(u.wP)}%</span>}{u.wG > 0 && <span className="w-g" style={{ width: `${pct(u.wG)}%` }}>{u.ttype === "수시학종" ? "서류" : "내신"} {pct(u.wG)}%</span>}{u.wC > 0 && <span className="w-c" style={{ width: `${pct(u.wC)}%` }}>수능 {pct(u.wC)}%</span>}{u.wO > 0 && <span className={/면접/.test(u.method) ? "w-o" : "w-s"} style={{ width: `${pct(u.wO)}%` }}>{/면접/.test(u.method) ? "면접" : "서류"} {pct(u.wO)}%</span>}</div>
      <dl className="kv"><dt>전형방법</dt><dd>{u.method}</dd>{u.stage1 && <><dt>1단계</dt><dd>{u.stage1}</dd></>}<dt>실기</dt><dd>{u.exam || "없음"}{u.paper ? ` · ${u.paper}` : ""}</dd>
        <dt>내신 반영</dt><dd>{u.gpa_subjects}</dd>{u.csat_min && <><dt>수능최저</dt><dd>{u.csat_min}</dd></>}{u.csat_areas && <><dt>수능 반영</dt><dd>{u.csat_areas}{u.eng ? ` · 영어 ${u.eng}등급대` : ""}</dd></>}{u.note && <><dt>비고</dt><dd>{u.note}</dd></>}</dl></div>
    <div className="card"><b>전년도(2026) 합격자 성적</b>
      {u.round === "수시" ? <dl className="kv"><dt>내신 최고</dt><dd className="num">{g(u.gpa_best)}</dd><dt>내신 평균</dt><dd className="num">{g(u.gpa_avg)}</dd><dt>70% 컷</dt><dd className="num">{g(u.gpa_cut70)}</dd><dt>최저</dt><dd className="num">{g(u.gpa_min)}</dd><dt>기준</dt><dd>{u.gpa_basis || "–"}</dd></dl>
        : <dl className="kv"><dt>수능 백분위</dt><dd className="num">{u.csat_pct == null ? "자료 없음" : `${u.csat_pct} ± ${u.csat_pm}`}</dd><dt>기준</dt><dd>학원 추정 합격 성적대 (공식 입결 아님)</dd></dl>}
      <span className="tiny">출처: {({ ...DATA.sources, ...TRACK_DATA.sources } as Record<string, string>)[u.src.split("·")[0]] || u.src} · 상태: {u.verify}</span></div>
    <UnivTracksCard ukey={fullName(u)} st={st} byId={byId} open={open} compact />
    <PassPrep u={u} st={st} toCareer={toCareer} />
    <button className="btn block" onClick={() => setTarget(u.id)}>{target === u.id ? "목표 대학으로 설정됨 ✓" : "목표 대학으로 설정"}</button>
  </>;
}

// ---------------- 로드맵 ----------------
function Road({ ctx, u, go }: { ctx: Ctx; u?: Program; go: (t: Tab) => void }) {
  if (!u) return <><h2 className="sec">합격 로드맵</h2><div className="notice">대학찾기에서 목표 대학을 먼저 정해 주세요.</div><button className="btn" onClick={() => go("match")}>대학찾기</button></>;
  const j = judge(u, toStudent(ctx)); const { months, weak, steps } = buildPlan(u, j, ctx); const w2 = weak.slice(0, 2);
  return <>
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
        <label className="f">희망 전공<select id="pf-major" value={p.major} onChange={(e) => { const m = e.target.value; setP((x) => ({ ...x, major: m, ...(isNew && MAJOR_TRACK[m] ? { track: MAJOR_TRACK[m][0], field: MAJOR_TRACK[m][1] } : {}) })); }}>{MAJORS.map((m) => <option key={m}>{m}</option>)}</select></label>
      </div>
      <div className="grid2">
        <label className="f"><span>내신 등급 <span className="tiny">({sys}등급제)</span></span><NumInput id="pf-gpa" min={1} max={sys} value={p.gpa} onCommit={(v) => set("gpa", v ?? 1)} placeholder={`1 ~ ${sys}`} /></label>
        <label className="f"><span>모의고사 평균 백분위</span><NumInput id="pf-mock" min={0} max={100} allowEmpty value={p.mockKnown ? p.mock : null} placeholder="모르면 비워두기" onCommit={(v) => { set("mockKnown", v !== null); set("mock", v ?? 0); }} /></label>
      </div>
      <div className="grid2">
        <label className="f">계열<select id="pf-track" value={p.track} onChange={(e) => { const t = e.target.value; setP((x) => ({ ...x, track: t, field: fieldsOf(t).includes(x.field) ? x.field : fieldsOf(t)[0] })); }}>{TRACKS.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="f">분야<select id="pf-field" value={p.field} onChange={(e) => set("field", e.target.value)}>{fieldsOf(p.track).map((f) => <option key={f} value={f}>{f.replace("(게임)", "")}</option>)}</select></label>
      </div>
      <span className="tiny">작품 분야와 같은 5계열 21분야예요. 학원 찾기·주간 연습 과제가 이 분야에 맞춰져요.</span>
      <span className="f-label">선호 지역 <span className="tiny">(대학·학원 찾기에 반영, 여러 곳 선택)</span></span>
      <div className="rgroups">{REGION_GROUPS.map(([g, rs]) => { const on = rs.every((r) => p.regions.includes(r)); return <button type="button" key={g} aria-pressed={on} onClick={() => set("regions", on ? p.regions.filter((r) => !rs.includes(r)) : [...new Set([...p.regions, ...rs])])}>{g}</button>; })}</div>
      <div className="daypick wrap">{REGIONS.map((r) => <button type="button" key={r} aria-pressed={p.regions.includes(r)} onClick={() => set("regions", p.regions.includes(r) ? p.regions.filter((x) => x !== r) : [...p.regions, r])}>{r}</button>)}</div>
      <label className="f">미술학원 시작 (연-월)<input id="pf-academy" type="month" value={p.academyStart} onChange={(e) => set("academyStart", e.target.value)} /></label>
      <span className="tiny">고1·고2는 5등급제, 고3·N수는 9등급제예요 (2028 대입개편). 대학 입결(9등급제)과 비교할 때는 같은 석차 비율로 환산해요. 학원 {academyMonths(p)}개월. 모의고사를 비우면 내신 수준으로 추정해요.</span>
      {err && <div className="err" role="alert">{err}</div>}{msg && <div className="ok-msg">{msg}</div>}
      <button className="btn block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : isNew ? "프로필 저장하고 시작하기" : "저장"}</button>
    </form>
    {!isNew && <div className="card"><b>수상 경력</b>
      <div className="awards">{awards.length ? awards.map((a) => { const b = benefitFor(a.title); return <div className="award" key={a.id}><span>{a.title}{a.level ? <span className="tiny"> · {a.level.split("|")[0]}</span> : null}{a.verified ? " ✓" : ""}{b ? <span className="tiny benefit-hit"><br />입시특전 연결: {b.univ} · {b.benefit}{b.status === "확인 필요" ? " (편집부 확인 필요)" : ""}</span> : null}</span><button onClick={async () => { await S.deleteAward(a.id); await reload(); }} aria-label={`${a.title} 삭제`}>삭제</button></div>; }) : <span className="small muted">아직 없어요.</span>}</div>
      <form className="card" style={{ padding: 0, border: 0 }} onSubmit={addAw}><label className="f"><span className="tiny">대회명 · 연월</span><input id="aw-in" value={aw} onChange={(e) => setAw(e.target.value)} placeholder="예: 전국 미술실기대회 (2026.08)" /></label>
        <div className="grid2"><label className="f"><span className="tiny">상</span><select value={lv} onChange={(e) => setLv(e.target.value)}>{LEVELS.map((x) => <option key={x}>{x}</option>)}</select></label><label className="f"><span className="tiny">규모</span><select value={sc} onChange={(e) => setSc(e.target.value)}>{SCOPES.map((x) => <option key={x}>{x}</option>)}</select></label></div>
        <button className="btn line" type="submit">수상 추가</button></form>
      <span className="tiny">교외 수상은 학생부에 기재되지 않아 대입에 직접 반영되지 않아요. 앱은 실기 실력 추정에만 써요. 「미대입시」 주최 대회 수상은 앞으로 자동 인증됩니다.</span></div>}
    {!isNew && <div className="card"><b>대학 실기대회 수상 시 본교 입시특전</b>
      <span className="small muted">대학이 직접 여는 실기대회는 그 대학에 지원할 때 가산점·우선입학·장학금 등 혜택을 주기도 해요. 대회명에 대학 이름을 넣어 수상을 추가하면 위에 특전이 연결돼요.</span>
      <div className="benefits">{BENEFITS.map((b) => <div key={b.univ} className="benefit">
        <div className="row between"><b className="small">{b.univ}</b><span className={`chip ${b.status === "확인" ? "t-fit" : "t-hope"}`}>{b.status === "확인" ? "확인" : "편집부 확인 필요"}</span></div>
        <span className="tiny">{b.contest}</span>
        <span className="small">{b.benefit}</span>
        <span className="tiny">{b.basis}{b.source ? <> · 출처 <a href={b.source.url} target="_blank" rel="noopener">{b.source.name}</a></> : null}</span>
      </div>)}</div>
      <span className="tiny">특전은 해마다 바뀌어요. 지원 전 반드시 해당 대학의 당해 모집요강과 대회 공고를 확인하세요. 특전 정보는 「월간 미대입시」 편집부가 계속 보완합니다.</span></div>}
    {!isNew && <ConsentCard user={user} />}
    <button className="btn line block" onClick={onSignOut}>로그아웃</button>
    <div className="row" style={{ gap: 12, justifyContent: "center" }}><a className="linkbtn tiny" href={`${WEB_URL}privacy.html`} target="_blank" rel="noopener">개인정보 처리방침</a><a className="linkbtn tiny" href={`${WEB_URL}terms.html`} target="_blank" rel="noopener">이용약관</a></div>
    <Withdraw user={user} onDone={onSignOut} />
    <p className="tiny">버전 {APP_VERSION}{IS_NATIVE ? ` · ${PLATFORM === "ios" ? "iOS" : "Android"} 앱` : ""}</p>
  </>;
}

// 회원 탈퇴 — 스토어 정책상 앱 안에서 바로 탈퇴할 수 있어야 함
function Withdraw({ user, onDone }: { user: AuthUser; onDone: () => void }) {
  const [open, setOpen] = useState(false), [txt, setTxt] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  if (!open) return <button className="linkbtn tiny" style={{ alignSelf: "center", color: "var(--ink-3)" }} onClick={() => setOpen(true)}>회원 탈퇴</button>;
  return <div className="card"><b>회원 탈퇴</b>
    <ul className="list small"><li>입시 프로필·수상 경력·올린 작품과 AI 진단·플래너 기록이 모두 지워지고 되돌릴 수 없어요.</li><li>선배로 등록했다면 선배 프로필과 정산 계좌 정보도 지워져요.</li><li>멘토 조언 결제·정산 기록은 전자상거래법에 따라 5년간 보관한 뒤 지워요.</li></ul>
    <label className="f"><span className="tiny">확인을 위해 <b>탈퇴</b>라고 입력하세요</span><input value={txt} onChange={(e) => setTxt(e.target.value)} /></label>
    {err && <div className="notice" role="alert">{err}</div>}
    <div className="row" style={{ gap: 8 }}><button className="btn line" onClick={() => { setOpen(false); setTxt(""); }}>취소</button>
      <button className="btn" disabled={txt.trim() !== "탈퇴" || busy} onClick={async () => { setBusy(true); setErr(""); try { await S.deleteAccount(user); onDone(); } catch (x) { setErr((x as Error).message); setBusy(false); } }}>{busy ? "지우는 중…" : "탈퇴하고 모든 기록 삭제"}</button></div>
  </div>;
}
