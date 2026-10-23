// v0.10 멘토 탭 — 미대 선배(인증 조언자)와 입시생 1:1 조언 매칭
// 이용자: 선배 찾기·자동 매칭 → 요청 작성 → 결제(에스크로 보관) → 조언 수령 → 구매 확정 → 후기
// 조언자: 합격·재학 인증 서류 제출 → 운영자 승인 → 프로필 → 요청 수락·답변 → 정산(수수료·원천징수 3.3% 공제)
// 운영자: 인증 심사(확인 후 원본 삭제) · 요청·결제·환불 · 분쟁·신고 · 정산 · 수수료율 설정
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import DATA from "./lib/programs.json";
import type { Artwork, AuthUser, Profile } from "./lib/store";
import * as M from "./lib/market";
import * as S from "./lib/store";
import {
  ADVICE_FIELDS, DAYS, DOC_RULES, needReverify, FIELD_HINT, KINDS, MENTOR_ROLES, STATUS_STEPS, STATUS_STYLE, addHours, ago, candidates, left, rating, rid, sampleAnswer, scan, split, sweep, withhold, won,
  type AdviceField, type AdviceKind, type AdviceReq, type Att, type Mentor, type MentorDoc, type MentorRole, type Msg, type Payout, type ReqStatus, type Settings,
} from "./lib/mentor";

export type MentorSub = "find" | "my" | "mentor" | "admin";
type Mk = M.Market;
const UNIVS = [...new Set((DATA.programs as { univ: string }[]).map((p) => p.univ))].sort((a, b) => a.localeCompare(b, "ko"));
const Stars = ({ v }: { v: number }) => <span className="stars" aria-label={`평점 ${v.toFixed(1)}`}>{"★★★★★".slice(0, Math.round(v))}<i>{"★★★★★".slice(Math.round(v))}</i></span>;
const Note = ({ children }: { children: ReactNode }) => <div className="beta-note" role="note">{children}</div>;
const now = () => new Date().toISOString();
const sys = (text: string): Msg => ({ id: rid(), from: "system", text, at: now() });
// 정산 대상 금액 — 부분 환불이 있으면 그만큼 뺌
const payable = (r: AdviceReq) => (r.status === "환불 완료" ? 0 : r.price - (r.refund?.amount || 0));

export function MentorTab({ user, p, works, sub, setSub }: { user: AuthUser; p: Profile; works: Artwork[]; sub: MentorSub; setSub: (s: MentorSub) => void }) {
  const [mk, setMk] = useState<Mk | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ t: "req" | "mentor"; id: string } | null>(null);
  const reload = useCallback(async () => {
    try {
      const m = await M.loadMarket(user);
      // 기한이 지난 요청 상태 정리(자동 넘김·자동 환불·자동 구매 확정)
      for (let i = 0; i < m.reqs.length; i++) { const n = sweep(m.reqs[i], m.settings); if (n) { m.reqs[i] = n; await M.saveReq(n).catch(() => {}); } }
      m.reqs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); setMk(m); setErr("");
    } catch (x) { setErr((x as Error).message); }
  }, [user]);
  useEffect(() => { reload(); const t = setInterval(reload, 60000); return () => clearInterval(t); }, [reload]);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(""); try { await fn(); await reload(); return true; } catch (x) { setErr((x as Error).message); return false; } finally { setBusy(false); } };
  const go = (s: MentorSub) => { setSub(s); setOpen(null); window.scrollTo(0, 0); };
  if (!mk) return <><h1 className="page">미대 선배 멘토</h1>{err ? <div className="err" role="alert">{err}</div> : <div className="loading">불러오는 중…</div>}</>;
  const me = mk.mentors.find((m) => m.id === user.id);
  const subs: [MentorSub, string][] = [["find", "선배 찾기"], ["my", "내 요청"], ["mentor", "선배로 활동"], ...(mk.admin ? [["admin", "운영자"] as [MentorSub, string]] : [])];
  const ctx: Ctx = { user, p, works, mk, me, act, busy, open: (t, id) => { setOpen({ t, id }); window.scrollTo(0, 0); }, go };
  let view: ReactNode;
  if (open?.t === "req" && mk.reqs.some((r) => r.id === open.id)) view = <ReqView c={ctx} r={mk.reqs.find((r) => r.id === open.id)!} back={() => setOpen(null)} as={sub === "admin" ? "admin" : sub === "mentor" ? "mentor" : "student"} />;
  else if (open?.t === "mentor" && mk.mentors.some((m) => m.id === open.id)) view = <MentorProfile c={ctx} m={mk.mentors.find((m) => m.id === open.id)!} back={() => setOpen(null)} />;
  else view = sub === "find" ? <Find c={ctx} /> : sub === "my" ? <MyReqs c={ctx} /> : sub === "mentor" ? <MentorHome c={ctx} /> : <Admin c={ctx} />;
  return <>
    <h1 className="page">미대 선배 멘토</h1>
    <div className="seg" role="group" aria-label="멘토 메뉴">{subs.map(([k, t]) => <button key={k} aria-pressed={sub === k} onClick={() => go(k)}>{t}</button>)}</div>
    {!mk.server && <Note><b>베타 · 테스트 결제</b> 실제 돈은 오가지 않아요. 요청·인증·정산 기록은 이 기기에 저장돼요(서버 연결 전). 한 기기에서 다른 계정으로 로그인하면 선배·운영자 역할도 시험할 수 있어요. '가상' 표시 선배는 기능 시험용 가상 인물이에요.</Note>}
    {mk.server && <Note><b>베타 · 테스트 결제</b> 실제 돈은 오가지 않아요. 정식 결제(PG 에스크로)는 사업자 계약 후 연결돼요. '가상' 표시 선배는 시험용 가상 인물이에요.</Note>}
    {err && <div className="err" role="alert">{err}</div>}
    {view}
  </>;
}
interface Ctx { user: AuthUser; p: Profile; works: Artwork[]; mk: Mk; me?: Mentor; act: (fn: () => Promise<unknown>) => Promise<boolean>; busy: boolean; open: (t: "req" | "mentor", id: string) => void; go: (s: MentorSub) => void }

// ======================= 이용자: 선배 찾기 =======================
type Query = { field: AdviceField; kind: AdviceKind; univ: string; dept: string };
function Find({ c }: { c: Ctx }) {
  const [q, setQ] = useState<Query>({ field: "실기", kind: "small", univ: "", dept: "" });
  const [sort, setSort] = useState<"추천" | "평점" | "가격">("추천");
  const [compose, setCompose] = useState<{ mode: "direct" | "auto"; mentor?: Mentor } | null>(null);
  const list = useMemo(() => {
    const xs = candidates(c.mk.mentors.filter((m) => m.id !== c.user.id), q, c.mk.reviews);
    return sort === "평점" ? [...xs].sort((a, b) => b.r.avg - a.r.avg) : sort === "가격" ? [...xs].sort((a, b) => a.m.price[q.kind] - b.m.price[q.kind]) : xs;
  }, [c.mk, q, sort, c.user.id]);
  if (compose) return <Compose c={c} q={q} mode={compose.mode} mentor={compose.mentor} pool={list.length} back={() => setCompose(null)} />;
  const set = <K extends keyof Query>(k: K, v: Query[K]) => setQ((x) => ({ ...x, [k]: v }));
  return <>
    <div className="card hero"><b style={{ fontSize: 17 }}>합격한 선배에게 1:1로 묻기</b>
      <span className="small muted">재학·성적 증명서로 인증된 미대생 선배가 서류·면접·포트폴리오·학생부·실기를 건별로 조언해요.</span>
      <div className="flow4">{["분야 고르기", "선배 선택 또는 자동 매칭", "결제 (앱이 보관)", "조언 받고 확정"].map((t, i) => <span key={t}><b className="num">{i + 1}</b>{t}</span>)}</div>
    </div>
    <div className="card"><b>1. 어떤 조언이 필요해요? <span className="tiny">(필수)</span></b>
      <div className="fieldpick">{ADVICE_FIELDS.map((f) => <button type="button" key={f} aria-pressed={q.field === f} onClick={() => set("field", f)}><b>{f}</b><span className="tiny">{FIELD_HINT[f]}</span></button>)}</div>
      <b>2. 조언 크기</b>
      <div className="seg" role="group" aria-label="조언 유형">{(["small", "big"] as AdviceKind[]).map((k) => <button key={k} aria-pressed={q.kind === k} onClick={() => set("kind", k)}>{KINDS[k].label}</button>)}</div>
      <span className="tiny">{KINDS[q.kind].ex} · {KINDS[q.kind].form} · {won(KINDS[q.kind].min)}~{won(KINDS[q.kind].max)} (선배가 정한 가격)</span>
      <b>3. 학교·학과 <span className="tiny">(선택 · 비우면 분야만으로 찾아요)</span></b>
      <div className="grid2">
        <label className="f"><span className="tiny">학교</span><input list="univ-list" value={q.univ} placeholder="예: 홍익대" onChange={(e) => set("univ", e.target.value)} /></label>
        <label className="f"><span className="tiny">학과</span><input value={q.dept} placeholder="예: 시각디자인" onChange={(e) => set("dept", e.target.value)} /></label>
      </div>
      <datalist id="univ-list">{[...new Set([...UNIVS, ...c.mk.mentors.map((m) => m.univ)])].map((u) => <option key={u} value={u} />)}</datalist>
      <button className="btn block" disabled={!list.length} onClick={() => setCompose({ mode: "auto" })}>{list.length ? `자동 매칭으로 바로 요청 (조건 맞는 선배 ${list.length}명)` : "조건에 맞는 선배가 아직 없어요"}</button>
      <span className="tiny">자동 매칭은 조건에 맞는 선배 모두에게 요청을 보내고 <b>먼저 수락한 선배</b>와 연결해요. {c.mk.settings.autoHours}시간 안에 수락이 없으면 전액 환불돼요.</span>
    </div>
    <div className="row between"><h2 className="sec" style={{ margin: 0 }}>조건에 맞는 선배 {list.length}명</h2>
      <select aria-label="정렬" className="mini" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>{["추천", "평점", "가격"].map((x) => <option key={x} value={x}>{x}순</option>)}</select></div>
    {list.map(({ m, r }) => <button key={m.id} className="card-btn" onClick={() => c.open("mentor", m.id)}><MentorCard m={m} r={r} kind={q.kind} /></button>)}
    {!list.length && <div className="notice">{q.univ ? `${q.univ} 출신 선배 중 '${q.field}' 조언이 가능한 분이 아직 없어요. 학교를 비우고 분야만으로 찾아보세요.` : "이 조건의 선배가 아직 없어요. 조언 크기를 바꿔 보세요."}</div>}
    <div className="card"><b>안심하고 이용하세요</b>
      <ul className="list small">
        <li>선배는 <b>재학증명서·성적증명서</b>(강사·교수는 재직증명서)를 운영자가 직접 확인한 뒤에만 보여요. 확인한 원본은 바로 삭제해요.</li>
        <li>결제 금액은 앱이 보관했다가 조언을 받고 <b>구매 확정</b>해야 선배에게 전달돼요. 수락 전 취소는 전액 환불이에요.</li>
        <li>조언과 첨삭만 해요. <b>실기 대리 작업·서류 대필은 금지</b>예요.</li>
        <li>전화번호·메신저 아이디 교환과 직거래는 막혀 있어요. 앱 밖 거래는 보호받지 못해요.</li>
      </ul></div>
  </>;
}
function MentorCard({ m, r, kind }: { m: Mentor; r: { n: number; avg: number }; kind: AdviceKind }) {
  return <div className="card mentor">
    <div className="row between"><span className="name">{m.name} {m.sample && <span className="chip plain">가상</span>}</span><span className="chip t-fit">✓ {m.role === "미대 재학생" ? "재학 인증" : "경력 인증"}</span></div>
    <div className="small"><b>{m.univ}</b> {m.dept} · {m.role === "미대 재학생" ? `${String(m.entryYear).slice(2)}학번 · ${m.admitTrack} 합격` : m.admitTrack}</div>
    <div className="tags">{m.fields.map((f) => <span key={f}>{f}</span>)}</div>
    <div className="row between small"><span>{r.n ? <><Stars v={r.avg} /> <b className="num">{r.avg.toFixed(1)}</b> <span className="tiny">({r.n})</span></> : <span className="tiny">신규 선배</span>}</span><b className="num">{m.kinds.includes(kind) ? won(m.price[kind]) : "–"}<span className="tiny"> / {KINDS[kind].label}</span></b></div>
  </div>;
}
function MentorProfile({ c, m, back }: { c: Ctx; m: Mentor; back: () => void }) {
  const r = rating(c.mk.reviews, m.id); const rs = c.mk.reviews.filter((x) => x.mentorId === m.id);
  const [field, setField] = useState<AdviceField>(m.fields[0]); const [kind, setKind] = useState<AdviceKind>(m.kinds[0]);
  const [go, setGo] = useState(false);
  if (go) return <Compose c={c} q={{ field, kind, univ: m.univ, dept: m.dept }} mode="direct" mentor={m} pool={1} back={() => setGo(false)} />;
  return <>
    <button className="back" onClick={back}>← 목록</button>
    <MentorCard m={m} r={r} kind={kind} />
    <div className="card"><b>소개</b><p className="small" style={{ margin: 0 }}>{m.intro}</p>
      <dl className="kv"><dt>가능 시간</dt><dd>{m.days.join("·")} · {m.hours}</dd><dt>조언 가격</dt><dd>{m.kinds.map((k) => `${KINDS[k].label} ${won(m.price[k])}`).join(" · ")}</dd>
        <dt>인증</dt><dd>{m.docLog ? `${m.docLog.kinds.join("·")} 확인 (${m.docLog.checkedAt.slice(0, 10)})` : "확인 완료"}</dd></dl></div>
    <div className="card"><b>요청하기</b>
      <div className="tags pick">{m.fields.map((f) => <button key={f} aria-pressed={field === f} onClick={() => setField(f)}>{f}</button>)}</div>
      <div className="seg" role="group">{m.kinds.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{KINDS[k].label} {won(m.price[k])}</button>)}</div>
      <button className="btn block" disabled={m.id === c.user.id} onClick={() => setGo(true)}>{m.name}에게 요청 쓰기</button>
      <span className="tiny">선배가 {c.mk.settings.directHours}시간 안에 수락하지 않으면 같은 조건의 다른 선배에게 자동으로 넘겨요.</span></div>
    <div className="card"><b>후기 {r.n}개</b>{rs.length ? rs.slice(0, 10).map((x) => <div className="review" key={x.reqId}><div className="row between"><Stars v={x.rating} /><span className="tiny">{x.at.slice(0, 10)}</span></div><span className="small">{x.text}</span></div>) : <span className="small muted">아직 후기가 없어요. 후기는 결제·구매 확정한 이용자만 쓸 수 있어요.</span>}</div>
  </>;
}

// ---------- 요청 작성 → 결제 ----------
function Compose({ c, q, mode, mentor, pool, back }: { c: Ctx; q: Query; mode: "direct" | "auto"; mentor?: Mentor; pool: number; back: () => void }) {
  const price = mentor ? mentor.price[q.kind] : KINDS[q.kind].base;
  const minor = c.p.grade !== "N수";
  const [title, setTitle] = useState(""), [text, setText] = useState(""), [files, setFiles] = useState<File[]>([]), [wid, setWid] = useState("");
  const [step, setStep] = useState<"write" | "pay">("write"), [pay, setPay] = useState("카드"), [g, setG] = useState(false), [gName, setGName] = useState(""), [agree, setAgree] = useState(false), [err, setErr] = useState("");
  const sc = scan(title + "\n" + text);
  function next() {
    setErr(""); if (!title.trim() || text.trim().length < 10) { setErr("제목과 질문(10자 이상)을 써 주세요."); return; }
    setStep("pay"); window.scrollTo(0, 0);
  }
  async function submit() {
    if (minor && (!g || !gName.trim())) { setErr("미성년자는 보호자(법정대리인) 동의와 보호자 이름이 필요해요."); return; }
    if (!agree) { setErr("이용 규칙에 동의해 주세요."); return; }
    const id = rid(); const s = c.mk.settings;
    const ok = await c.act(async () => {
      const att: Att[] = [];
      for (const f of files) att.push(await M.uploadAtt(c.user, id, f, "student"));
      const w = c.works.find((x) => x.id === wid);
      if (w?.url) { const b = await (await fetch(w.url)).blob(); att.push(await M.uploadAtt(c.user, id, new File([b], `내작품-${w.genre}.jpg`, { type: "image/jpeg" }), "student")); }
      const t = scan(title), body = scan(text);
      const r: AdviceReq = {
        id, studentId: c.user.id, studentName: c.p.name || c.user.email.split("@")[0], studentEmail: c.user.email, minor, guardian: minor ? gName.trim() : undefined,
        field: q.field, univ: q.univ.trim(), dept: q.dept.trim(), kind: q.kind, mode, targetMentorId: mentor?.id, title: t.clean.trim(), question: body.clean.trim(), files: att, workLabel: w ? `${w.genre} (${w.madeOn})` : undefined,
        price, feeRate: s.feeRate, status: "수락 대기", createdAt: now(), paidAt: now(), acceptBy: addHours(mode === "direct" ? s.directHours : s.autoHours), declined: [],
        messages: [{ id: rid(), from: "student", text: body.clean.trim(), at: now(), flags: [...t.flags, ...body.flags], files: att }, sys(`${pay} 테스트 결제 ${won(price)} 완료 · 금액은 앱이 보관하고 있어요. ${mode === "direct" ? `${mentor?.name}의 수락을 기다려요` : `조건에 맞는 선배 ${pool}명에게 요청을 보냈어요`}.`)],
      };
      await M.saveReq(r);
    });
    if (ok) { c.go("my"); }
  }
  if (step === "pay") return <>
    <button className="back" onClick={() => setStep("write")}>← 요청 수정</button>
    <h2 className="sec">결제</h2>
    <div className="card"><div className="row between"><b>{q.field} · {KINDS[q.kind].label}</b><span className="chip plain">{mode === "direct" ? `지정: ${mentor?.name}` : "자동 매칭"}</span></div>
      <span className="small muted">{title}</span>
      <div className="row between"><span>결제 금액</span><b className="num" style={{ fontSize: 22 }}>{won(price)}</b></div>
      <span className="tiny">결제 금액은 앱(미대갈래)이 보관해요. 선배가 조언을 마치고 내가 '구매 확정'을 누르면 선배에게 전달돼요.</span></div>
    <div className="card"><b>결제 수단 <span className="chip t-hope">테스트</span></b>
      <div className="seg" role="group">{["카드", "카카오페이", "토스페이", "계좌이체"].map((x) => <button key={x} aria-pressed={pay === x} onClick={() => setPay(x)}>{x}</button>)}</div>
      <span className="tiny">베타에서는 실제 결제가 일어나지 않아요.</span></div>
    {minor && <div className="card"><b>보호자(법정대리인) 동의</b>
      <span className="small muted">만 19세 미만은 유료 서비스 결제에 보호자 동의가 필요해요(민법 제5조).</span>
      <label className="f"><span className="tiny">보호자 이름</span><input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="예: 홍길동" /></label>
      <label className="check"><input type="checkbox" checked={g} onChange={(e) => setG(e.target.checked)} /><span>보호자가 이 결제와 개인정보 제공(선배에게 질문·첨부 공개)에 동의했어요.</span></label></div>}
    <div className="card"><b>환불 기준</b>
      <ul className="list small"><li>선배 수락 전: 언제든 <b>전액 환불</b></li><li>기한 안에 수락한 선배가 없으면: <b>자동 전액 환불</b></li><li>조언 시작 후: 환불 요청 → 운영자 <b>분쟁 심사</b>(전액·부분·불가)</li><li>답변 후 {c.mk.settings.autoConfirmDays}일 동안 확인이 없으면 자동 구매 확정</li></ul>
      <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>(필수) 조언·첨삭만 받고 <b>대리 작업·대필을 요청하지 않으며</b>, 연락처 교환·직거래를 하지 않을게요. 환불 기준을 확인했어요.</span></label></div>
    {err && <div className="err" role="alert">{err}</div>}
    <button className="btn block" disabled={c.busy} onClick={submit}>{c.busy ? <span className="spinner" /> : `${won(price)} 테스트 결제하고 요청 보내기`}</button>
  </>;
  return <>
    <button className="back" onClick={back}>← 뒤로</button>
    <h2 className="sec">{mode === "direct" ? `${mentor?.name}에게 요청` : `자동 매칭 요청 · 선배 ${pool}명에게 전달`}</h2>
    <div className="card"><div className="tags"><span className="on">{q.field}</span><span>{KINDS[q.kind].label}</span>{q.univ && <span>{q.univ}</span>}{q.dept && <span>{q.dept}</span>}</div>
      <label className="f">제목<input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={q.field === "실기" ? "예: 기초디자인 구도가 답답해요" : q.field === "면접" ? "예: 작품 설명 1분 답변 봐주세요" : "예: 자기소개서 1번 문항 첨삭"} /></label>
      <label className="f">질문 내용<textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="상황·고민·받고 싶은 조언을 구체적으로 써 주세요. (연락처는 자동으로 가려져요)" /></label>
      {sc.flags.length > 0 && <div className="err small" role="alert">⚠ {sc.flags.join(" · ")} 감지: 연락처는 가려서 보내고, 대리 작업·대필 요청은 받을 수 없어요.</div>}
      <label className="f"><span className="tiny">내 작품 첨부 (선택)</span><select value={wid} onChange={(e) => setWid(e.target.value)}><option value="">{c.works.length ? "선택 안 함" : "올린 작품 없음"}</option>{c.works.map((w) => <option key={w.id} value={w.id}>{w.genre} · {w.madeOn}</option>)}</select></label>
      <label className="f"><span className="tiny">파일 첨부 (사진·PDF, 최대 5개 · 10MB)</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles([...(e.target.files || [])].slice(0, 5))} /></label>
      {files.length > 0 && <span className="tiny">{files.map((f) => f.name).join(", ")}</span>}
      <span className="tiny">첨부한 작품·서류는 연결된 선배와 운영자만 볼 수 있고, 볼 때마다 열람자 워터마크가 표시돼요.</span>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn block" onClick={next}>다음: 결제 ({won(price)})</button></div>
  </>;
}

// ======================= 이용자: 내 요청 =======================
function MyReqs({ c }: { c: Ctx }) {
  const mine = c.mk.reqs.filter((r) => r.studentId === c.user.id);
  const live = mine.filter((r) => ["수락 대기", "진행 중", "답변 완료", "분쟁 심사"].includes(r.status));
  return <>
    <div className="grid3"><div className="stat"><span className="k">진행 중</span><span className="v">{live.length}</span></div><div className="stat"><span className="k">완료</span><span className="v">{mine.filter((r) => ["구매 확정", "정산 완료"].includes(r.status)).length}</span></div><div className="stat"><span className="k">결제 합계</span><span className="v" style={{ fontSize: 17 }}>{won(mine.reduce((a, r) => a + payable(r), 0))}</span></div></div>
    {mine.length ? mine.map((r) => <ReqRow key={r.id} r={r} who={r.mentorName || (r.mode === "auto" ? "자동 매칭 중" : c.mk.mentors.find((m) => m.id === r.targetMentorId)?.name || "")} onClick={() => c.open("req", r.id)} />)
      : <div className="notice">아직 요청이 없어요. '선배 찾기'에서 첫 조언을 받아 보세요.<br /><button className="linkbtn" onClick={() => c.go("find")}>선배 찾기 →</button></div>}
  </>;
}
function ReqRow({ r, who, onClick, extra }: { r: AdviceReq; who: string; onClick: () => void; extra?: ReactNode }) {
  return <button className="card-btn" onClick={onClick}><div className="card req">
    <div className="row between"><b className="small">{r.title}</b><span className={`chip ${STATUS_STYLE[r.status]}`}>{r.status}</span></div>
    <div className="tiny">{r.field} · {KINDS[r.kind].label} · {who} · {ago(r.createdAt)}</div>
    <div className="row between small"><span>{r.status === "수락 대기" ? <span className="warn-t">수락 {left(r.acceptBy)}</span> : r.status === "진행 중" && r.dueAt ? <span>답변 기한 {left(r.dueAt)}</span> : null}{r.messages.some((m) => m.flags?.length) ? <span className="chip t-reach" style={{ marginLeft: 6 }}>감지</span> : null}</span><b className="num">{won(r.price)}</b></div>
    {extra}
  </div></button>;
}

// ======================= 요청 상세 (이용자·선배·운영자 공용) =======================
function ReqView({ c, r, back, as }: { c: Ctx; r: AdviceReq; back: () => void; as: "student" | "mentor" | "admin" }) {
  const role: "student" | "mentor" | "admin" = r.studentId === c.user.id && as !== "admin" ? "student" : as;
  const mentor = c.mk.mentors.find((m) => m.id === (r.mentorId || r.targetMentorId));
  const [msg, setMsg] = useState(""), [files, setFiles] = useState<File[]>([]), [warn, setWarn] = useState<string[]>([]);
  const [refundWhy, setRefundWhy] = useState(""), [showRefund, setShowRefund] = useState(false);
  const [rv, setRv] = useState(5), [rvText, setRvText] = useState(""), [rep, setRep] = useState(false), [repWhy, setRepWhy] = useState("전공 외 분야·허위 경력"), [repText, setRepText] = useState("");
  const save = (n: AdviceReq) => c.act(() => M.saveReq(n));
  const sp = split(r.price, r.feeRate), wh = withhold(sp.earn);
  const canChat = ["수락 대기", "진행 중", "답변 완료"].includes(r.status) && role !== "admin" && (role === "student" || r.mentorId === c.user.id);
  async function send(done = false) {
    const s = scan(msg);
    if (!msg.trim() && !files.length && !done) return;
    setWarn(s.flags);
    await c.act(async () => {
      const att: Att[] = []; for (const f of files) att.push(await M.uploadAtt(c.user, r.id, f, role === "mentor" ? "mentor" : "student"));
      const ms: Msg[] = msg.trim() || att.length ? [{ id: rid(), from: role === "mentor" ? "mentor" : "student", text: s.clean.trim(), at: now(), flags: s.flags, files: att }] : [];
      const n: AdviceReq = { ...r, files: [...r.files, ...att], messages: [...r.messages, ...ms] };
      if (done) Object.assign(n, { status: "답변 완료" as ReqStatus, answeredAt: now(), messages: [...n.messages, sys(`선배가 조언을 마쳤어요. 내용을 확인하고 '구매 확정'을 눌러 주세요. ${c.mk.settings.autoConfirmDays}일 뒤 자동 확정돼요.`)] });
      else if (role === "student" && r.status === "답변 완료") Object.assign(n, { status: "진행 중" as ReqStatus });
      await M.saveReq(n);
    });
    setMsg(""); setFiles([]);
  }
  const accept = (m: Mentor) => save({ ...r, status: "진행 중", mentorId: m.id, mentorName: m.name, acceptedAt: now(), dueAt: addHours(KINDS[r.kind].dueHours), messages: [...r.messages, sys(`선배 연결 완료: ${m.name}. ${KINDS[r.kind].dueHours / 24}일 안에 조언을 드려요.`)] });
  // 데모: 가상 선배가 수락하고 답변 (실제 서비스에는 없음)
  async function demoAnswer() {
    const cand = mentor?.sample ? mentor : candidates(c.mk.mentors, r, c.mk.reviews, r.declined).find((x) => x.m.sample)?.m;
    if (!cand) return;
    await save({ ...r, status: "답변 완료", mentorId: cand.id, mentorName: cand.name, acceptedAt: now(), answeredAt: now(), dueAt: addHours(KINDS[r.kind].dueHours),
      messages: [...r.messages, sys(`선배 연결 완료: ${cand.name}.`), { id: rid(), from: "mentor", text: sampleAnswer(r), at: now() }, sys("선배가 조언을 마쳤어요. 확인 후 '구매 확정'을 눌러 주세요.")] });
  }
  return <>
    <button className="back" onClick={back}>← 목록</button>
    <div className="card"><div className="row between"><span className={`chip ${STATUS_STYLE[r.status]}`}>{r.status}</span><span className="tiny">{r.createdAt.slice(0, 16).replace("T", " ")}</span></div>
      <b style={{ fontSize: 17 }}>{r.title}</b>
      <div className="tags"><span className="on">{r.field}</span><span>{KINDS[r.kind].label}</span>{r.univ && <span>{r.univ}</span>}{r.dept && <span>{r.dept}</span>}<span>{r.mode === "direct" ? "선배 지정" : r.passedOn ? "자동 넘김" : "자동 매칭"}</span></div>
      {STATUS_STEPS.includes(r.status) || r.status === "정산 완료" ? <div className="steps">{STATUS_STEPS.map((s, i) => <span key={s} className={STATUS_STEPS.indexOf(r.status === "정산 완료" ? "구매 확정" : r.status) >= i ? "on" : ""}>{s}</span>)}</div> : null}
      <dl className="kv"><dt>선배</dt><dd>{r.mentorName || (mentor && r.mode === "direct" ? `${mentor.name} (수락 대기)` : "연결 중")}</dd>
        <dt>{role === "student" ? "결제" : "학생"}</dt><dd>{role === "student" ? `${won(r.price)} · 앱 보관 중` : `${r.studentName}${r.minor ? ` · 미성년(보호자 ${r.guardian || "동의"})` : ""}`}</dd>
        {r.status === "수락 대기" && <><dt>수락 기한</dt><dd className="warn-t">{left(r.acceptBy)}</dd></>}
        {r.status === "진행 중" && r.dueAt && <><dt>답변 기한</dt><dd>{left(r.dueAt)}</dd></>}
        {r.refund && <><dt>환불</dt><dd>{r.refund.result || "심사 중"}{r.refund.amount ? ` · ${won(r.refund.amount)}` : ""} · 사유: {r.refund.reason}</dd></>}</dl>
      {role !== "student" && <div className="money small"><span>조언비 {won(r.price)}</span><span>− 수수료 {Math.round(r.feeRate * 100)}% {won(sp.fee)}</span><span>− 원천징수 3.3% {won(wh.incomeTax + wh.localTax)}</span><b>선배 실수령 {won(wh.net)}</b></div>}
    </div>
    {role === "mentor" && r.status === "수락 대기" && c.me && (() => { const me = c.me!; return <div className="row" style={{ gap: 8 }}>
      <button className="btn" style={{ flex: 1 }} disabled={c.busy} onClick={() => accept(me)}>수락하기</button>
      <button className="btn line" style={{ flex: 1 }} disabled={c.busy} onClick={() => save({ ...r, declined: [...r.declined, me.id], ...(r.targetMentorId === me.id ? { mode: "auto" as const, passedOn: true, targetMentorId: undefined, acceptBy: addHours(c.mk.settings.autoHours), messages: [...r.messages, sys("지정한 선배가 이번 요청을 받을 수 없어 같은 조건의 다른 선배에게 넘겼어요.")] } : {}) }).then(back)}>거절</button></div>; })()}
    <h2 className="sec">대화</h2>
    <div className="chat">{r.messages.map((m) => <div key={m.id} className={`bubble ${m.from}${(m.from === "student" && role === "student") || (m.from === "mentor" && role === "mentor") ? " me" : ""}`}>
      {m.from !== "system" && <span className="who tiny">{m.from === "student" ? r.studentName : m.from === "mentor" ? r.mentorName || "선배" : "운영자"} · {ago(m.at)}</span>}
      {m.text && <span className="t">{m.text}</span>}
      {m.files?.map((f) => <FileChip key={f.id} f={f} viewer={c.user.email} />)}
      {m.flags?.length ? <span className="flag tiny">⚠ {m.flags.join(" · ")} 감지{role === "admin" ? " · 운영자 검토 대상" : " · 연락처는 자동으로 가려졌어요"}</span> : null}
    </div>)}</div>
    {canChat && <div className="card compose">
      <textarea rows={role === "mentor" ? 5 : 3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={role === "mentor" ? "조언·첨삭 내용을 써 주세요. (대신 그려 주거나 대신 써 주는 것은 금지)" : "추가 질문 쓰기"} />
      <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles([...(e.target.files || [])].slice(0, 5))} />
      {warn.length > 0 && <div className="err small">⚠ {warn.join(" · ")} 감지: 연락처는 가려서 보냈어요. 반복되면 이용이 제한될 수 있어요.</div>}
      <div className="row" style={{ gap: 8 }}><button className="btn line" style={{ flex: 1 }} disabled={c.busy} onClick={() => send()}>보내기</button>
        {role === "mentor" && r.status === "진행 중" && <button className="btn" style={{ flex: 1 }} disabled={c.busy || !r.messages.some((m) => m.from === "mentor") && !msg.trim()} onClick={() => send(true)}>조언 완료로 표시</button>}</div>
    </div>}
    {role === "student" && <>
      {r.status === "수락 대기" && <><button className="btn line block" disabled={c.busy} onClick={() => save({ ...r, status: "환불 완료", refund: { reason: "수락 전 이용자 취소", at: now(), amount: r.price, result: "전액 환불" }, messages: [...r.messages, sys(`요청을 취소하고 ${won(r.price)}을 전액 환불했어요.`)] })}>요청 취소 (전액 환불)</button>
        {(mentor?.sample || (r.mode === "auto" && candidates(c.mk.mentors, r, c.mk.reviews, r.declined).some((x) => x.m.sample))) && <button className="btn ghost block" disabled={c.busy} onClick={demoAnswer}>[데모] 가상 선배가 수락·답변하기</button>}</>}
      {r.status === "답변 완료" && <button className="btn block" disabled={c.busy} onClick={() => save({ ...r, status: "구매 확정", confirmedAt: now(), messages: [...r.messages, sys("구매 확정했어요. 보관 중인 금액이 선배에게 정산돼요. 후기를 남겨 주세요!")] })}>구매 확정</button>}
      {["진행 중", "답변 완료"].includes(r.status) && (showRefund ? <div className="card"><b>환불 요청</b><span className="tiny">조언이 시작된 뒤라 운영자가 대화 내용을 확인하고 전액·부분·불가를 정해요.</span>
        <select value={refundWhy} onChange={(e) => setRefundWhy(e.target.value)}><option value="">사유 선택</option>{["기한 안에 조언을 받지 못함", "요청과 다른 분야의 조언", "성의 없는 답변", "선배 프로필과 실제 경력이 다름", "기타"].map((x) => <option key={x}>{x}</option>)}</select>
        <button className="btn block" disabled={!refundWhy || c.busy} onClick={() => save({ ...r, status: "분쟁 심사", refund: { reason: refundWhy, at: now() }, messages: [...r.messages, sys(`이용자가 환불을 요청했어요(사유: ${refundWhy}). 운영자가 영업일 3일 안에 심사해요.`)] })}>환불 요청 보내기</button></div>
        : <button className="linkbtn" onClick={() => setShowRefund(true)}>환불 요청</button>)}
      {["구매 확정", "정산 완료"].includes(r.status) && !r.review && r.mentorId && <div className="card"><b>후기 남기기</b><span className="tiny">결제·구매 확정한 이용자만 쓸 수 있어요.</span>
        <div className="starpick" role="radiogroup" aria-label="평점">{[1, 2, 3, 4, 5].map((k) => <button key={k} role="radio" aria-checked={rv === k} className={k <= rv ? "on" : ""} onClick={() => setRv(k)}>★</button>)}</div>
        <textarea rows={3} value={rvText} onChange={(e) => setRvText(e.target.value)} placeholder="어떤 점이 도움이 됐나요?" />
        <button className="btn block" disabled={c.busy || rvText.trim().length < 5} onClick={() => c.act(async () => { const rev = { reqId: r.id, mentorId: r.mentorId!, rating: rv, text: scan(rvText).clean.trim(), at: now(), by: r.studentName.slice(0, 1) + "○○", field: r.field }; await M.saveReview({ ...rev, byId: c.user.id }); await M.saveReq({ ...r, review: rev }); })}>후기 등록</button></div>}
      {r.review && <div className="card"><b>내 후기</b><Stars v={r.review.rating} /><span className="small">{r.review.text}</span></div>}
      {r.mentorId && (rep ? <div className="card"><b>선배 신고</b><select value={repWhy} onChange={(e) => setRepWhy(e.target.value)}>{["전공 외 분야·허위 경력", "외부 연락처·직거래 유도", "대리 작업·대필 제안", "불쾌한 언행", "기타"].map((x) => <option key={x}>{x}</option>)}</select>
        <textarea rows={2} value={repText} onChange={(e) => setRepText(e.target.value)} placeholder="상황을 적어 주세요" />
        <button className="btn line block" disabled={c.busy} onClick={() => c.act(() => M.saveReport({ id: rid(), reqId: r.id, mentorId: r.mentorId, mentorName: r.mentorName, byId: c.user.id, byName: r.studentName, reason: repWhy, text: repText.trim(), at: now(), status: "접수" })).then(() => setRep(false))}>신고 접수</button></div>
        : <button className="linkbtn" style={{ color: "var(--reach)" }} onClick={() => setRep(true)}>선배 신고하기</button>)}
    </>}
    {role === "admin" && <AdminReqActions c={c} r={r} />}
  </>;
}
function FileChip({ f, viewer }: { f: Att | MentorDoc; viewer: string }) {
  const [u, setU] = useState<string | null>(null);
  const bucket = "by" in f ? "advice-files" : "mentor-docs";
  async function open() { const url = await M.fileUrl(bucket, f); if (f.type === "application/pdf") { const w = window.open(); if (w) w.location.href = url; } else setU(url); }
  // 이미지 위에 열람자 이메일 워터마크 — 캡처·도용 억제 (의뢰서 11: 작품 저작권·도용 방지)
  const wm = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='140'><text x='10' y='80' transform='rotate(-24 120 70)' fill='rgba(255,255,255,0.5)' stroke='rgba(0,0,0,0.25)' stroke-width='0.4' font-size='13' font-family='sans-serif'>미대갈래 · ${viewer.replace(/[<>&'"]/g, "")} · 무단 복제 금지</text></svg>`)}")`;
  return <>
    <button type="button" className="filechip" onClick={open}>{f.type === "application/pdf" ? "📄" : "🖼"} {"kind" in f ? `${f.kind} · ` : ""}{f.name}</button>
    {u && <div className="viewer" role="dialog" aria-modal="true" aria-label="첨부 보기" onClick={() => setU(null)} onContextMenu={(e) => e.preventDefault()}>
      <div className="viewer-box"><img src={u} alt={f.name} draggable={false} /><div className="wm" style={{ backgroundImage: wm }} /></div>
      <span className="tiny" style={{ color: "#fff" }}>연결된 선배·운영자만 볼 수 있는 파일이에요 · 누르면 닫혀요</span></div>}
  </>;
}

// ======================= 조언자(선배) =======================
function MentorHome({ c }: { c: Ctx }) {
  const [edit, setEdit] = useState(false);
  const me = c.me;
  if (!me || edit || me.status === "반려") return <Apply c={c} me={me} done={() => setEdit(false)} />;
  if (me.status === "심사 대기") return <div className="card"><span className="chip t-hope" style={{ alignSelf: "flex-start" }}>심사 대기</span><b>인증 서류를 확인하고 있어요</b>
    <span className="small muted">운영자가 제출한 서류({me.docs.map((d) => d.kind).join("·")})를 확인한 뒤 승인하면 선배 목록에 보이고 요청을 받을 수 있어요. 보통 영업일 1~2일 걸려요.</span>
    <button className="btn line" onClick={() => setEdit(true)}>신청 내용 고치기</button></div>;
  if (me.status === "정지") return <div className="card"><span className="chip t-reach" style={{ alignSelf: "flex-start" }}>활동 정지</span><b>활동이 정지됐어요</b><span className="small muted">사유: {me.reason || "운영 정책 위반"}. 이의가 있으면 월간 미대입시 운영팀에 문의해 주세요.</span></div>;
  return <MentorDash c={c} me={me} edit={() => setEdit(true)} />;
}
function MentorDash({ c, me, edit }: { c: Ctx; me: Mentor; edit: () => void }) {
  const reqs = c.mk.reqs;
  const inbox = reqs.filter((r) => r.status === "수락 대기" && r.studentId !== me.id && !r.declined.includes(me.id) && (r.targetMentorId === me.id || (r.mode === "auto" && candidates([me], r, c.mk.reviews).length > 0)));
  const mine = reqs.filter((r) => r.mentorId === me.id);
  const ready = mine.filter((r) => r.status === "구매 확정" && !r.payoutId);
  const gross = ready.reduce((a, r) => a + payable(r), 0), fee = ready.reduce((a, r) => a + split(payable(r), r.feeRate).fee, 0), wh = withhold(gross - fee);
  const pays = c.mk.payouts.filter((p) => p.mentorId === me.id);
  const r = rating(c.mk.reviews, me.id);
  const month = mine.filter((x) => (x.confirmedAt || "").slice(0, 7) === now().slice(0, 7)).reduce((a, x) => a + withhold(split(payable(x), x.feeRate).earn).net, 0);
  async function withdraw() {
    const p: Payout = { id: rid(), mentorId: me.id, mentorName: me.name, reqIds: ready.map((x) => x.id), gross, fee, earn: gross - fee, incomeTax: wh.incomeTax, localTax: wh.localTax, net: wh.net, status: "신청", at: now() };
    await c.act(async () => { await M.savePayout(p); for (const x of ready) await M.saveReq({ ...x, payoutId: p.id }); });
  }
  return <>
    <div className="card hero"><div className="row between"><b>{me.name} · {me.univ} {me.dept}</b><span className="chip" style={{ background: "var(--accent-ink)", color: "var(--accent)" }}>✓ 인증 선배</span></div>
      <div className="grid3"><div><div className="num" style={{ fontSize: 22 }}>{inbox.length}</div><span className="small">새 요청</span></div><div><div className="num" style={{ fontSize: 22 }}>{mine.filter((x) => x.status === "진행 중").length}</div><span className="small">진행 중</span></div><div><div className="num" style={{ fontSize: 22 }}>{r.n ? r.avg.toFixed(1) : "–"}</div><span className="small">평점 ({r.n})</span></div></div>
      <span className="small muted">이번 달 확정 수입(실수령 기준) {won(month)}</span></div>
    {needReverify(me) && <div className="err" role="alert">재학 확인 기간(한 학기)이 지났어요. 이번 학기 재학증명서를 다시 올려 주세요. <button className="linkbtn" onClick={edit}>재인증 신청</button></div>}
    <label className="check card"><input type="checkbox" checked={!me.away} onChange={(e) => c.act(() => M.saveMentor({ ...me, away: !e.target.checked }))} /><span><b>요청 받기</b> <span className="tiny">끄면 선배 목록과 자동 매칭에서 잠시 빠져요(시험 기간 등)</span></span></label>
    <h2 className="sec">새 요청 · 먼저 수락한 선배와 연결돼요</h2>
    {inbox.length ? inbox.map((x) => <ReqRow key={x.id} r={x} who={x.targetMentorId === me.id ? "나를 지정" : "자동 매칭"} onClick={() => c.open("req", x.id)} extra={<span className="tiny">예상 실수령 {won(withhold(split(x.price, x.feeRate).earn).net)}</span>} />) : <div className="notice">지금은 새 요청이 없어요. 가능 분야를 넓히면 더 많은 요청을 받을 수 있어요.</div>}
    <h2 className="sec">내가 맡은 조언</h2>
    {mine.length ? mine.map((x) => <ReqRow key={x.id} r={x} who={x.studentName} onClick={() => c.open("req", x.id)} />) : <div className="notice">아직 맡은 조언이 없어요.</div>}
    <div className="card"><b>정산</b>
      <dl className="kv"><dt>정산 가능 {ready.length}건</dt><dd className="num">{won(gross)}</dd><dt>플랫폼 수수료</dt><dd className="num">− {won(fee)}</dd><dt>원천징수 3.3%</dt><dd className="num">− {won(wh.incomeTax + wh.localTax)} <span className="tiny">(소득세 {won(wh.incomeTax)} · 지방세 {won(wh.localTax)})</span></dd><dt><b>실지급액</b></dt><dd><b className="num">{won(wh.net)}</b></dd></dl>
      <button className="btn block" disabled={!ready.length || c.busy || !me.bank} onClick={withdraw}>{me.bank ? `출금 신청 (${me.bank.bank} ···${me.bank.last4})` : "정산 계좌를 먼저 등록해 주세요"}</button>
      <span className="tiny">선배는 프리랜서(사업소득)로 정산돼요. 원천징수한 세금은 미대갈래가 대신 신고·납부하고 지급명세서를 제출해요. 5월 종합소득세 신고 때 기납부 세액으로 빠져요.</span>
      {pays.map((p) => <div className="award" key={p.id}><span className="small">{p.at.slice(0, 10)} · {p.reqIds.length}건 · <b className="num">{won(p.net)}</b></span><span className={`chip ${p.status === "지급 완료" ? "t-fit" : "t-hope"}`}>{p.status}</span></div>)}</div>
    <button className="btn line block" onClick={edit}>프로필·가능 분야·가격 수정</button>
  </>;
}
function Apply({ c, me, done }: { c: Ctx; me?: Mentor; done: () => void }) {
  const [m, setM] = useState<Mentor>(() => me || { id: c.user.id, email: c.user.email, name: "", role: "미대 재학생", univ: "", dept: "", entryYear: new Date().getFullYear(), admitTrack: "수시 실기", fields: ["실기"], kinds: ["small"], price: { small: 15000, big: 60000 }, days: ["토", "일"], hours: "", intro: "", status: "심사 대기", docs: [], agreed: false, createdAt: now() });
  const [acct, setAcct] = useState(""), [err, setErr] = useState(""), [up, setUp] = useState(""), [enrolled, setEnrolled] = useState(!!me);
  const set = <K extends keyof Mentor>(k: K, v: Mentor[K]) => setM((x) => ({ ...x, [k]: v }));
  const rule = DOC_RULES[m.role]; const has = (k: string) => m.docs.some((d) => d.kind === k);
  const approved = me?.status === "승인";
  async function addDoc(kind: string, f?: File) {
    if (!f) return; setErr(""); setUp(kind);
    try { const d = await M.uploadDoc(c.user, kind, f); setM((x) => ({ ...x, docs: [...x.docs.filter((y) => y.kind !== kind), d] })); } catch (x) { setErr((x as Error).message); } finally { setUp(""); }
  }
  async function submit() {
    setErr("");
    if (!m.name.trim() || !m.univ.trim() || !m.dept.trim()) { setErr("이름·학교·학과를 입력해 주세요."); return; }
    if (!m.fields.length || !m.kinds.length) { setErr("가능 분야와 조언 유형을 하나 이상 골라 주세요."); return; }
    for (const k of m.kinds) if (m.price[k] < KINDS[k].min || m.price[k] > KINDS[k].max) { setErr(`${KINDS[k].label} 가격은 ${won(KINDS[k].min)}~${won(KINDS[k].max)} 사이로 정해 주세요.`); return; }
    if (!approved && rule.need.some((k) => !has(k))) { setErr(`필수 서류(${rule.need.join("·")})를 모두 올려 주세요.`); return; }
    if (!m.agreed) { setErr("조언자 활동 규칙에 동의해 주세요."); return; }
    if (m.role === "미대 재학생" && !enrolled) { setErr("현재 재학 중(휴학 아님)인지 확인해 주세요."); return; }
    const digits = acct.replace(/\D/g, "");
    const bank = digits.length >= 8 ? { ...(m.bank || { bank: "", holder: "" }), last4: digits.slice(-4) } : m.bank;
    if (bank && (!bank.bank || !bank.holder)) { setErr("은행과 예금주를 입력해 주세요."); return; }
    const ok = await c.act(() => M.saveMentor({ ...m, name: m.name.trim(), intro: scan(m.intro).clean, bank, status: approved ? "승인" : "심사 대기", reason: undefined }));
    if (ok) done();
  }
  return <>
    {!me && <div className="card hero"><b style={{ fontSize: 17 }}>합격 경험이 수입이 돼요</b>
      <span className="small muted">미대 재학생·입시미술 강사·원장·교수라면 누구나. 원하는 시간에, 건별로 조언하고 조언비를 받아요.</span>
      <div className="money small" style={{ background: "transparent", color: "inherit" }}><span>예) 작은 조언 15,000원</span><span>− 수수료 {Math.round(c.mk.settings.feeRate * 100)}% {won(split(15000, c.mk.settings.feeRate).fee)}</span><span>− 원천징수 3.3% {won(15000 - split(15000, c.mk.settings.feeRate).fee - withhold(split(15000, c.mk.settings.feeRate).earn).net)}</span><b>실수령 {won(withhold(split(15000, c.mk.settings.feeRate).earn).net)}</b></div></div>}
    {me?.status === "반려" && <div className="err" role="alert">인증이 반려됐어요 · 사유: {me.reason}. 서류를 다시 올려 신청해 주세요.</div>}
    <div className="card"><b>{approved ? "프로필 수정" : "1. 선배 정보"}</b>
      <label className="f">활동 유형<select value={m.role} disabled={approved} onChange={(e) => set("role", e.target.value as MentorRole)}>{MENTOR_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="f">이름 (목록에는 성 + ○○로 표시)<input value={m.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 김민지" /></label>
      <div className="grid2"><label className="f">{m.role === "미대 재학생" || m.role === "대학 교수" ? "학교" : "학원(소속)"}<input list="univ-list2" disabled={approved} value={m.univ} onChange={(e) => set("univ", e.target.value)} /></label>
        <label className="f">{m.role === "미대 재학생" ? "학과" : m.role === "대학 교수" ? "학과" : "경력"}<input disabled={approved} value={m.dept} onChange={(e) => set("dept", e.target.value)} placeholder={m.role === "미대 재학생" ? "예: 시각디자인과" : "예: 입시미술 7년"} /></label></div>
      <datalist id="univ-list2">{UNIVS.map((u) => <option key={u} value={u} />)}</datalist>
      {m.role === "미대 재학생" && <div className="grid2"><label className="f">입학 연도<select disabled={approved} value={m.entryYear} onChange={(e) => set("entryYear", +e.target.value)}>{[2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        <label className="f">합격 전형<select disabled={approved} value={m.admitTrack} onChange={(e) => set("admitTrack", e.target.value)}>{["수시 실기", "수시 학종", "수시 교과", "수시 미술활동보고서", "정시 실기", "정시 비실기", "특기자·기타"].map((y) => <option key={y}>{y}</option>)}</select></label></div>}
      {m.role !== "미대 재학생" && <label className="f">한 줄 경력<input value={m.admitTrack} onChange={(e) => set("admitTrack", e.target.value)} placeholder="예: 홍익대 시디 출신 · 강사 7년" /></label>}
      <span className="f-label">가능 분야</span>
      <div className="tags pick">{ADVICE_FIELDS.map((f) => <button key={f} type="button" aria-pressed={m.fields.includes(f)} onClick={() => set("fields", m.fields.includes(f) ? m.fields.filter((x) => x !== f) : [...m.fields, f])}>{f}</button>)}</div>
      <span className="f-label">조언 유형 · 가격 <span className="tiny">(플랫폼 가격 범위 안에서 직접 정해요)</span></span>
      {(["small", "big"] as AdviceKind[]).map((k) => <div className="row" key={k} style={{ gap: 8 }}><label className="check" style={{ flex: 1 }}><input type="checkbox" checked={m.kinds.includes(k)} onChange={() => set("kinds", m.kinds.includes(k) ? m.kinds.filter((x) => x !== k) : [...m.kinds, k])} /><span>{KINDS[k].label} <span className="tiny">{won(KINDS[k].min)}~{won(KINDS[k].max)}</span></span></label>
        <input className="price" type="number" step={1000} min={KINDS[k].min} max={KINDS[k].max} value={m.price[k]} onChange={(e) => set("price", { ...m.price, [k]: +e.target.value })} aria-label={`${KINDS[k].label} 가격`} /></div>)}
      <span className="f-label">가능 요일</span>
      <div className="daypick">{DAYS.map((d) => <button type="button" key={d} aria-pressed={m.days.includes(d)} onClick={() => set("days", m.days.includes(d) ? m.days.filter((x) => x !== d) : [...m.days, d])}>{d}</button>)}</div>
      <label className="f">가능 시간<input value={m.hours} onChange={(e) => set("hours", e.target.value)} placeholder="예: 평일 저녁 8~11시" /></label>
      <label className="f">소개 (연락처 금지)<textarea rows={3} value={m.intro} onChange={(e) => set("intro", e.target.value)} placeholder="합격 경험, 잘 봐줄 수 있는 것" /></label>
    </div>
    {!approved && <div className="card"><b>2. 인증 서류</b>
      <span className="small muted">{m.role === "미대 재학생" ? "재학증명서와 성적증명서(직전 학기까지)는 필수예요. 합격증이 있으면 함께 올려 주세요." : "소속·경력을 확인할 수 있는 서류를 올려 주세요."} 주민등록번호 뒷자리는 가리고 올려 주세요.</span>
      {[...rule.need.map((k) => [k, true] as const), ...rule.optional.map((k) => [k, false] as const)].map(([k, need]) => <label key={k} className={`docrow${has(k) ? " has" : ""}`}>
        <span><b className="small">{k}</b> <span className="tiny">{need ? "필수" : "선택"}</span>{has(k) && <span className="tiny"><br />✓ {m.docs.find((d) => d.kind === k)!.name}</span>}</span>
        <span className="btn ghost">{up === k ? <span className="spinner" /> : has(k) ? "다시 올리기" : "올리기"}</span>
        <input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { addDoc(k, e.target.files?.[0]); e.target.value = ""; }} /></label>)}
      <span className="tiny">서류는 운영자만 열람하는 비공개 저장소에 보관되고, 심사가 끝나면 원본은 삭제돼요(확인한 서류 종류·날짜만 남아요).</span></div>}
    <div className="card"><b>{approved ? "정산 계좌" : "3. 정산 계좌"} <span className="tiny">(나중에 등록해도 돼요)</span></b>
      <div className="grid2"><label className="f"><span className="tiny">은행</span><input value={m.bank?.bank || ""} onChange={(e) => set("bank", { bank: e.target.value, holder: m.bank?.holder || "", last4: m.bank?.last4 || "" })} placeholder="예: 국민" /></label>
        <label className="f"><span className="tiny">예금주</span><input value={m.bank?.holder || ""} onChange={(e) => set("bank", { bank: m.bank?.bank || "", holder: e.target.value, last4: m.bank?.last4 || "" })} /></label></div>
      <label className="f"><span className="tiny">계좌번호 {m.bank?.last4 ? `(등록됨 ···${m.bank.last4})` : ""}</span><input inputMode="numeric" value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="숫자만" /></label>
      <span className="tiny">베타에서는 계좌번호 끝 4자리만 저장해요. 정식 출시 때는 정산 대행(PG) 본인 인증으로 계좌와 원천징수용 정보를 안전하게 받아요.</span></div>
    {!approved && <div className="card"><b>4. 조언자 활동 규칙</b>
      <ul className="list small"><li>조언·첨삭만 해요. <b>실기 대리 작업·서류 대필은 하지 않아요.</b></li><li>전화번호·메신저 교환, 앱 밖 직거래를 하지 않아요(위반 시 활동 정지).</li><li>합격 학교·학과·경력을 사실대로 적어요. 허위가 확인되면 정산이 보류되고 활동이 정지돼요.</li><li>학생이 올린 작품·서류는 조언에만 쓰고 저장·공유하지 않아요.</li><li>조언비는 수수료 {Math.round(c.mk.settings.feeRate * 100)}%와 원천징수 3.3%를 뺀 뒤 정산돼요.</li></ul>
      {m.role === "미대 재학생" ? <label className="check"><input type="checkbox" checked={enrolled} onChange={(e) => setEnrolled(e.target.checked)} /><span>(필수) 지금 <b>재학 중</b>이에요(휴학 아님). 대학 재학생은 개인과외교습 신고가 면제되지만 휴학생은 교육청 신고 대상이라 휴학하면 활동을 멈춰야 해요. 재학 확인은 학기마다 다시 받아요.</span></label>
        : <span className="tiny">학원 밖에서 개인적으로 교습비를 받는 강사·원장은 「학원법」 제14조의2에 따라 개인과외교습자 신고 대상일 수 있어요. 신고증명서가 있으면 함께 올려 주세요.</span>}
      <label className="check"><input type="checkbox" checked={m.agreed} onChange={(e) => set("agreed", e.target.checked)} /><span>(필수) 위 규칙과 개인정보(인증 서류) 수집·이용에 동의해요.</span></label></div>}
    {err && <div className="err" role="alert">{err}</div>}
    <button className="btn block" disabled={c.busy || !!up} onClick={submit}>{c.busy ? <span className="spinner" /> : approved ? "저장" : me ? "다시 신청하기" : "인증 신청하기"}</button>
    {me && <button className="btn line block" onClick={done}>취소</button>}
  </>;
}

// ======================= 운영자 =======================
type AdminSub = "verify" | "reqs" | "dispute" | "pay" | "mkt" | "set";
function Admin({ c }: { c: Ctx }) {
  const [sub, setSub] = useState<AdminSub>("verify");
  const { reqs, mentors, payouts, reports } = c.mk;
  const paid = reqs.filter((r) => r.paidAt), gmv = paid.reduce((a, r) => a + r.price, 0), refunds = reqs.reduce((a, r) => a + (r.refund?.amount || 0), 0);
  const feeRev = reqs.filter((r) => ["구매 확정", "정산 완료"].includes(r.status)).reduce((a, r) => a + split(payable(r), r.feeRate).fee, 0);
  const pending = mentors.filter((m) => m.status === "심사 대기"), disputes = reqs.filter((r) => r.status === "분쟁 심사"), openRep = reports.filter((r) => r.status === "접수");
  const flagged = reqs.filter((r) => r.messages.some((m) => m.flags?.length));
  const payWait = payouts.filter((p) => p.status === "신청");
  if (!c.mk.admin) return <div className="notice">운영자만 볼 수 있어요.</div>;
  return <>
    <div className="grid2">
      <div className="stat"><span className="k">결제 총액 (GMV)</span><span className="v" style={{ fontSize: 19 }}>{won(gmv)}</span><span className="tiny">{paid.length}건 · 환불 {won(refunds)}</span></div>
      <div className="stat"><span className="k">수수료 수익 (확정)</span><span className="v" style={{ fontSize: 19 }}>{won(feeRev)}</span><span className="tiny">수수료율 {Math.round(c.mk.settings.feeRate * 100)}%</span></div>
      <div className="stat"><span className="k">처리할 일</span><span className="v" style={{ fontSize: 19 }}>{pending.length + disputes.length + openRep.length + payWait.length}</span><span className="tiny">인증 {pending.length} · 분쟁 {disputes.length} · 신고 {openRep.length} · 정산 {payWait.length}</span></div>
      <div className="stat"><span className="k">활동 선배</span><span className="v" style={{ fontSize: 19 }}>{mentors.filter((m) => m.status === "승인" && !m.sample).length}</span><span className="tiny">가상 {mentors.filter((m) => m.sample).length}명 별도 · 감지 {flagged.length}건</span></div>
    </div>
    <div className="seg small-seg" role="group" aria-label="운영 메뉴">{([["verify", `인증 ${pending.length}`], ["reqs", "요청·결제"], ["dispute", `분쟁·신고 ${disputes.length + openRep.length}`], ["pay", `정산 ${payWait.length}`], ["mkt", "회원 동의"], ["set", "설정"]] as [AdminSub, string][]).map(([k, t]) => <button key={k} aria-pressed={sub === k} onClick={() => setSub(k)}>{t}</button>)}</div>
    {sub === "verify" ? <Verify c={c} /> : sub === "reqs" ? <>
      {flagged.length > 0 && <div className="card"><b>연락처·직거래·대필 감지 {flagged.length}건</b>{flagged.map((r) => <button key={r.id} className="pick" onClick={() => c.open("req", r.id)}><span className="small">{r.title}<br /><span className="tiny">{[...new Set(r.messages.flatMap((m) => m.flags || []))].join(" · ")}</span></span><span className="tiny">{r.mentorName || "미연결"}</span></button>)}</div>}
      <div className="card"><b>전체 요청 {reqs.length}건</b>
        <div className="tbl"><div className="th"><span>요청</span><span>상태</span><span>금액</span><span>수수료</span></div>
          {reqs.map((r) => <button key={r.id} className="tr" onClick={() => c.open("req", r.id)}><span>{r.studentName}→{r.mentorName || "–"}<br /><span className="tiny">{r.field} · {r.createdAt.slice(5, 10)}</span></span><span className={`chip ${STATUS_STYLE[r.status]}`}>{r.status}</span><span className="num">{won(r.price)}</span><span className="num">{won(split(payable(r), r.feeRate).fee)}</span></button>)}</div></div></>
      : sub === "dispute" ? <>
        <h2 className="sec">환불·분쟁 심사</h2>
        {disputes.length ? disputes.map((r) => <ReqRow key={r.id} r={r} who={`${r.studentName} → ${r.mentorName}`} onClick={() => c.open("req", r.id)} extra={<span className="tiny">사유: {r.refund?.reason}</span>} />) : <div className="notice">심사할 분쟁이 없어요.</div>}
        <h2 className="sec">신고</h2>
        {reports.length ? reports.map((x) => <div className="card" key={x.id}><div className="row between"><b className="small">{x.reason}</b><span className={`chip ${x.status === "접수" ? "t-reach" : "plain"}`}>{x.status}</span></div>
          <span className="small">{x.byName} → {x.mentorName} · {x.at.slice(0, 10)}</span>{x.text && <span className="small muted">{x.text}</span>}{x.action && <span className="tiny">처리: {x.action}</span>}
          {x.status === "접수" && <div className="row wrap" style={{ gap: 6 }}>
            {x.reqId && <button className="btn line" onClick={() => c.open("req", x.reqId!)}>대화 보기</button>}
            {[["경고", (m: Mentor) => ({ ...m, warn: (m.warn || 0) + 1 })], ["활동 정지", (m: Mentor) => ({ ...m, status: "정지" as const, reason: x.reason })], ["기각", null]].map(([t, f]) =>
              <button key={t as string} className="btn ghost" disabled={c.busy} onClick={() => c.act(async () => { const m = mentors.find((y) => y.id === x.mentorId); if (f && m) await M.saveMentor((f as (m: Mentor) => Mentor)(m)); await M.saveReport({ ...x, status: "처리 완료", action: t as string }); })}>{t as string}</button>)}
          </div>}</div>) : <div className="notice">접수된 신고가 없어요.</div>}</>
      : sub === "pay" ? <Payouts c={c} /> : sub === "mkt" ? <Consents /> : <SettingsView c={c} />}
  </>;
}
function AdminReqActions({ c, r }: { c: Ctx; r: AdviceReq }) {
  const save = (n: AdviceReq) => c.act(() => M.saveReq(n));
  const res = (amount: number, result: string, status: ReqStatus) => save({ ...r, status, confirmedAt: status === "구매 확정" ? now() : r.confirmedAt, refund: { ...(r.refund || { reason: "운영자 처리", at: now() }), amount, result }, messages: [...r.messages, { id: rid(), from: "admin", text: `운영자 심사 결과: ${result}${amount ? ` (${won(amount)} 환불)` : ""}.`, at: now() }] });
  if (r.status === "분쟁 심사") return <div className="card"><b>분쟁 심사</b><span className="small">사유: {r.refund?.reason}. 대화와 첨부를 확인하고 결정하세요.</span>
    <div className="row wrap" style={{ gap: 6 }}><button className="btn" disabled={c.busy} onClick={() => res(r.price, "전액 환불", "환불 완료")}>전액 환불</button>
      <button className="btn ghost" disabled={c.busy} onClick={() => res(Math.round(r.price / 2), "50% 부분 환불 · 나머지 선배 정산", "구매 확정")}>50% 환불</button>
      <button className="btn line" disabled={c.busy} onClick={() => res(0, "환불 불가 · 선배 정산", "구매 확정")}>환불 불가</button></div></div>;
  if (["수락 대기", "진행 중", "답변 완료"].includes(r.status)) return <button className="btn line block" disabled={c.busy} onClick={() => res(r.price, "운영자 직권 전액 환불", "환불 완료")}>운영자 직권 전액 환불</button>;
  return null;
}
function Verify({ c }: { c: Ctx }) {
  const [why, setWhy] = useState<Record<string, string>>({});
  const list = c.mk.mentors.filter((m) => !m.sample);
  const pending = list.filter((m) => m.status === "심사 대기");
  async function decide(m: Mentor, ok: boolean) {
    const reason = why[m.id] || "";
    if (!ok && !reason) return;
    await c.act(async () => {
      await M.purgeDocs(m); // 확인 끝난 원본 삭제
      await M.saveMentor({ ...m, status: ok ? "승인" : "반려", reason: ok ? undefined : reason, docs: [], docLog: { kinds: m.docs.map((d) => d.kind), checkedAt: now(), checkedBy: c.user.email, purged: true } });
    });
  }
  return <>
    <h2 className="sec">인증 심사 대기 {pending.length}명</h2>
    {pending.length ? pending.map((m) => { const rule = DOC_RULES[m.role]; const miss = rule.need.filter((k) => !m.docs.some((d) => d.kind === k)); return <div className="card" key={m.id}>
      <div className="row between"><b>{m.name}</b><span className="chip plain">{m.role}</span></div>
      <span className="small">{m.univ} {m.dept} · {m.role === "미대 재학생" ? `${m.entryYear} 입학 · ${m.admitTrack}` : m.admitTrack} · {m.email}</span>
      <div className="tags">{m.fields.map((f) => <span key={f}>{f}</span>)}</div>
      <b className="small">제출 서류</b>{m.docs.map((d) => <FileChip key={d.id} f={d} viewer={c.user.email} />)}
      {miss.length > 0 && <span className="err small">빠진 필수 서류: {miss.join(", ")}</span>}
      <ul className="list tiny"><li>서류의 이름·학교·학과가 신청 정보와 같은지</li><li>재학증명서 발급일이 3개월 이내인지</li><li>성적증명서의 학과·학년이 맞는지, 위·변조 흔적(발급번호 진위 확인)</li></ul>
      <select value={why[m.id] || ""} onChange={(e) => setWhy({ ...why, [m.id]: e.target.value })}><option value="">반려 사유 (반려할 때만)</option>{["서류가 흐리거나 잘림", "신청 정보와 서류 내용이 다름", "발급일 3개월 초과", "필수 서류 누락", "진위 확인 불가"].map((x) => <option key={x}>{x}</option>)}</select>
      <div className="row" style={{ gap: 8 }}><button className="btn" style={{ flex: 1 }} disabled={c.busy || miss.length > 0} onClick={() => decide(m, true)}>승인</button><button className="btn line" style={{ flex: 1 }} disabled={c.busy || !why[m.id]} onClick={() => decide(m, false)}>반려</button></div>
      <span className="tiny">승인·반려하면 서류 원본은 저장소에서 바로 삭제되고, 확인한 서류 종류·일시·확인자만 남아요.</span></div>; })
      : <div className="notice">심사할 신청이 없어요.</div>}
    <h2 className="sec">선배 관리</h2>
    <div className="card">{list.filter((m) => m.status !== "심사 대기").map((m) => <div className="award" key={m.id}><span className="small">{m.name} · {m.univ} {m.dept}<span className="tiny"><br />{m.status}{needReverify(m) ? " · 학기 재인증 필요" : ""}{m.warn ? ` · 경고 ${m.warn}회` : ""}{m.docLog ? ` · ${m.docLog.kinds.join("·")} 확인 ${m.docLog.checkedAt.slice(0, 10)}` : ""}</span></span>
      {m.status === "승인" ? <button onClick={() => c.act(() => M.saveMentor({ ...m, status: "정지", reason: "운영자 정지" }))}>정지</button> : m.status === "정지" ? <button onClick={() => c.act(() => M.saveMentor({ ...m, status: "승인", reason: undefined }))}>해제</button> : <span className="tiny">{m.status}</span>}</div>)}
      {!list.some((m) => m.status !== "심사 대기") && <span className="small muted">아직 심사한 선배가 없어요.</span>}</div>
  </>;
}
function Payouts({ c }: { c: Ctx }) {
  const ps = c.mk.payouts;
  function csv() {
    // 지급명세서(사업소득) 작성용 기초 자료 — 주민등록번호는 정식 정산 대행사 연동 후 추가
    const rows = [["신청일", "지급일", "선배", "건수", "지급총액(수수료 차감 후)", "소득세(3%)", "지방소득세(0.3%)", "실지급액", "플랫폼 수수료", "상태"], ...ps.map((p) => [p.at.slice(0, 10), p.paidAt?.slice(0, 10) || "", p.mentorName, p.reqIds.length, p.earn, p.incomeTax, p.localTax, p.net, p.fee, p.status])];
    const blob = new Blob(["﻿" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `미대갈래_정산내역_${now().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  return <>
    <div className="card"><b>정산 신청</b>
      {ps.length ? ps.map((p) => <div className="award" key={p.id}><span className="small">{p.mentorName} · {p.reqIds.length}건 · 실지급 <b className="num">{won(p.net)}</b><span className="tiny"><br />{p.at.slice(0, 10)} · 총 {won(p.gross)} − 수수료 {won(p.fee)} − 세금 {won(p.incomeTax + p.localTax)}</span></span>
        {p.status === "신청" ? <button className="btn ghost" disabled={c.busy} onClick={() => c.act(async () => { await M.savePayout({ ...p, status: "지급 완료", paidAt: now() }); for (const id of p.reqIds) { const r = c.mk.reqs.find((x) => x.id === id); if (r) await M.saveReq({ ...r, status: "정산 완료" }); } })}>지급 완료</button> : <span className="chip t-fit">지급 완료</span>}</div>) : <span className="small muted">정산 신청이 없어요.</span>}
      <button className="btn line block" disabled={!ps.length} onClick={csv}>정산 내역 엑셀(CSV) 받기 · 지급명세서 기초 자료</button>
      <span className="tiny">원천징수한 소득세·지방소득세는 지급한 달의 다음 달 10일까지 신고·납부하고, 간이지급명세서를 제출해요.</span></div>
  </>;
}
// (주)엠굿 마케팅 활용 동의 회원 — 가입회원 DB 마케팅은 동의한 회원·채널에만
function Consents() {
  const [list, setList] = useState<{ email: string; c: S.Consent }[] | null>(null), [err, setErr] = useState("");
  useEffect(() => { S.listConsents().then(setList).catch((x) => setErr((x as Error).message)); }, []);
  if (err) return <div className="err">{err}</div>;
  if (!list) return <div className="loading">불러오는 중…</div>;
  const on = list.filter((x) => x.c.marketing), due = on.filter((x) => S.reconfirmDue(x.c));
  const by = (ch: S.ConsentChannel) => on.filter((x) => x.c.channels.includes(ch)).length;
  function csv() {
    const rows = [["이메일", "동의", "받을 방법", "동의일", "재확인 기한", "철회일", "동의서 버전"], ...list!.map(({ email, c }) => [email, c.marketing ? "동의" : "미동의", c.channels.join("/"), c.at.slice(0, 10), c.marketing ? new Date(Date.parse(c.at) + 730 * 864e5).toISOString().slice(0, 10) : "", c.withdrawnAt?.slice(0, 10) || "", c.ver])];
    const blob = new Blob(["\ufeff" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `미대갈래_마케팅동의회원_${now().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  return <>
    <div className="grid2">
      <div className="stat"><span className="k">마케팅 동의 회원</span><span className="v" style={{ fontSize: 19 }}>{on.length}명</span><span className="tiny">응답 {list.length}명 중 {list.length ? Math.round((on.length / list.length) * 100) : 0}%</span></div>
      <div className="stat"><span className="k">받을 방법</span><span className="small" style={{ margin: "6px 0" }}>{S.CONSENT_CHANNELS.map((ch) => `${ch} ${by(ch)}명`).join(" · ")}</span><span className="tiny">2년 재확인 필요 {due.length}명</span></div>
    </div>
    <div className="card"><b>{S.CONSENT_TEXT.company} 마케팅 활용 동의</b>
      {on.length ? on.slice(0, 50).map(({ email, c }) => <div className="award" key={email}><span className="small">{email}<span className="tiny"><br />{c.channels.join(", ")} · {c.at.slice(0, 10)}{S.reconfirmDue(c) ? " · 재확인 필요" : ""}</span></span></div>) : <span className="small muted">아직 동의한 회원이 없어요.</span>}
      <button className="btn line block" disabled={!list.length} onClick={csv}>동의 회원 엑셀(CSV) 받기</button>
      <span className="tiny">동의한 회원에게, 고른 방법으로만 보내요. 광고 메시지는 제목 앞에 (광고), 보내는 곳·수신 거부 방법을 넣고, 밤 9시~아침 8시 발송은 따로 동의를 받아야 해요(정보통신망법 제50조). 동의일로부터 2년마다 수신 동의 여부를 다시 알려야 해요.</span></div>
  </>;
}
function SettingsView({ c }: { c: Ctx }) {
  const [s, setS] = useState<Settings>(c.mk.settings); const [ok, setOk] = useState("");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS((x) => ({ ...x, [k]: v })); setOk(""); };
  return <>
    <div className="card"><b>수수료·기한 설정</b>
      <label className="f"><span>플랫폼 수수료율 <b className="num">{Math.round(s.feeRate * 100)}%</b></span><input type="range" min={10} max={30} step={1} value={Math.round(s.feeRate * 100)} onChange={(e) => set("feeRate", +e.target.value / 100)} /></label>
      <span className="tiny">새 요청부터 적용돼요(이미 결제된 요청은 결제 당시 수수료율). 예) 조언비 1만 원 → 수수료 {won(split(10000, s.feeRate).fee)}, 선배 실수령 {won(withhold(split(10000, s.feeRate).earn).net)}</span>
      <div className="grid3"><label className="f"><span className="tiny">지정 수락(시간)</span><input type="number" min={1} max={72} value={s.directHours} onChange={(e) => set("directHours", +e.target.value)} /></label>
        <label className="f"><span className="tiny">자동 매칭(시간)</span><input type="number" min={1} max={72} value={s.autoHours} onChange={(e) => set("autoHours", +e.target.value)} /></label>
        <label className="f"><span className="tiny">자동 확정(일)</span><input type="number" min={1} max={14} value={s.autoConfirmDays} onChange={(e) => set("autoConfirmDays", +e.target.value)} /></label></div>
      {ok && <div className="ok-msg">{ok}</div>}
      <button className="btn block" disabled={c.busy} onClick={() => c.act(() => M.saveSettings(s)).then((x) => x && setOk("저장했어요"))}>저장</button></div>
    <div className="card"><b>이용약관 핵심 조항 (초안)</b>
      <ol className="list small">
        <li>미대갈래는 이용자와 조언자를 연결하는 <b>통신판매중개자</b>이며, 조언 내용의 책임은 조언자에게 있어요.</li>
        <li>조언자는 조언·첨삭만 제공해요. <b>실기 대리 작업·서류 대필·입시 부정</b>을 요청하거나 제공하면 즉시 활동 정지·환불·정산 보류해요.</li>
        <li>결제 금액은 미대갈래가 보관(에스크로)하고 구매 확정 후 수수료와 원천징수 세액을 뺀 금액을 조언자에게 지급해요.</li>
        <li>수락 전 취소·미수락은 전액 환불, 조언 시작 후 환불은 운영자 심사로 정해요.</li>
        <li>연락처 교환·직거래는 금지되며, 대화의 연락처는 자동으로 가려져요.</li>
        <li>만 19세 미만 이용자의 결제는 법정대리인 동의가 필요하며, 동의 없는 결제는 취소할 수 있어요.</li>
        <li>이용자가 올린 작품·서류의 저작권은 이용자에게 있으며, 조언 목적 외 사용·저장·공유를 금지해요.</li>
        <li>후기는 결제·구매 확정한 이용자만 쓸 수 있어요.</li>
      </ol><span className="tiny">정식 출시 전 법률 검토(전자상거래법·청소년보호·개인정보보호법)를 거쳐 확정해요.</span></div>
  </>;
}
