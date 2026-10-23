// v0.11 전형별 맞춤 피드백 — 관심 전형 설정, 전형별 하향·적정·소신·상향, 수시/정시 비중, 대학별 개설 전형·반영비율
import { useMemo, useState } from "react";
import * as S from "./lib/store";
import type { AuthUser } from "./lib/store";
import { judge, VERDICT_LABEL, VERDICT_STYLE, type Program, type Student, type Verdict } from "./lib/engine";
import { catStrategy, ELEMS, roundAdvice, TRACK_CATS, TRACK_DATA, univTracks, type Elem, type Track, type UnivTracks } from "./lib/strategy";

const VS: Verdict[] = ["안정", "적정", "소신", "상향"];
const ALL = TRACK_CATS.map((c) => c.k);

// 관심 전형 — 서버 테이블 없이 이 기기에 사용자별로 저장 (비어 있으면 전체)
export function useTrackPref(user: AuthUser): [string[], (v: string[]) => void] {
  const [v, setV] = useState<string[]>(() => S.uget<string[]>(user, "track-pref", []));
  return [v, (x) => { setV(x); S.uset(user, "track-pref", x); }];
}

export function PrefChips({ pref, setPref }: { pref: string[]; setPref: (v: string[]) => void }) {
  return <div className="tags pick" role="group" aria-label="관심 전형">
    {TRACK_CATS.map((c) => { const on = pref.includes(c.k); return <button type="button" key={c.k} aria-pressed={on} title={c.d} onClick={() => setPref(on ? pref.filter((x) => x !== c.k) : [...pref, c.k])}>{c.label}</button>; })}
  </div>;
}

export function Counts({ cnt, n }: { cnt: Record<Verdict, number>; n?: number }) {
  return <div className="vcounts">{VS.map((v) => <span key={v} className={`chip ${VERDICT_STYLE[v].c}`}>{VERDICT_LABEL[v]} <b className="num">{cnt[v]}</b></span>)}{n != null && <span className="tiny">/ {n}개</span>}</div>;
}

// ---------- 대학찾기 · 전형별 전략 ----------
export function StrategyPanel({ user, list, st, major, regions, open, fullName }: { user: AuthUser; list: Program[]; st: Student; major?: string; regions?: string[]; open: (id: string) => void; fullName: (p: Program) => string }) {
  const [pref, setPref] = useTrackPref(user);
  const cats = pref.length ? TRACK_CATS.filter((c) => pref.includes(c.k)).map((c) => c.k) : ALL;
  const res = useMemo(() => cats.map((k) => catStrategy(list, st, k, { major, regions })), [list, st, major, regions, cats.join()]);
  const adv = roundAdvice(st, res);
  const lv = { 유리: "t-fit", 보통: "t-hope", 불리: "t-reach", "해당 없음": "plain" } as const;
  return <>
    <div className="card"><b>관심 전형 설정</b>
      <span className="small muted">관심 있는 전형을 고르면 그 전형만 모아 내 위치를 알려 드려요. 아무것도 고르지 않으면 6개 전형을 모두 보여 드려요.</span>
      <PrefChips pref={pref} setPref={setPref} /></div>
    <div className="card"><div className="row between"><b>수시·정시 전략</b><span className="chip t-safe">{adv.head}</span></div>
      <ul className="list small">{adv.lines.map((l) => <li key={l}>{l}</li>)}</ul></div>
    {res.map((r) => <div className="card" key={r.k}>
      <div className="row between"><b>{r.label}</b><span className={`chip ${lv[r.level]}`}>{r.level}</span></div>
      <span className="tiny">{TRACK_CATS.find((c) => c.k === r.k)?.d}</span>
      <Counts cnt={r.cnt} n={r.n} />
      <span className="small">{r.tip}</span>
      {r.picks.length > 0 && <div className="plist">{r.picks.map(({ p, j }) => <button key={p.id} className="pick" onClick={() => open(p.id)}>
        <span><b className="small">{fullName(p)} {p.dept}</b><br /><span className="tiny">{p.track} · {p.method}</span></span>
        <span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{VERDICT_LABEL[j.verdict]}</span></button>)}</div>}
    </div>)}
    <p className="tiny">전형 자료: {TRACK_DATA.basis}. 판정은 내신·실기 지수·모의고사로 계산한 참고값이에요. 면접·서류 정성평가는 반영되지 않아요.</p>
  </>;
}

// ---------- 홈 카드 ----------
export function HomeTrackCard({ user, list, st, major, go }: { user: AuthUser; list: Program[]; st: Student; major: string; go: () => void }) {
  const [pref] = useTrackPref(user);
  const cats = pref.length ? pref : ["교과", "종합", "실기", "정시"];
  const res = useMemo(() => cats.map((k) => catStrategy(list, st, k, { major })), [list, st, major, cats.join()]);
  const adv = roundAdvice(st, res);
  return <button className="card-btn" onClick={go}><div className="card">
    <div className="row between"><b>{pref.length ? "관심 전형 맞춤 피드백" : "전형별 내 위치"}</b><span className="chip t-safe">{adv.head}</span></div>
    {res.map((r) => <div className="row between" key={r.k}><span className="small">{r.label}</span>
      <span className="tiny">하향 {r.cnt.안정} · 적정 {r.cnt.적정} · 소신 {r.cnt.소신} · 상향 {r.cnt.상향}</span></div>)}
    <span className="tiny">{pref.length ? "대학찾기 → 전형별 전략에서 관심 전형을 바꿀 수 있어요" : "관심 전형을 고르면 그 전형만 모아 피드백해 드려요 →"}</span>
  </div></button>;
}

// ---------- 대학별 개설 전형 ----------
const WCLS: Record<Elem, string> = { 교과: "w-g", 서류: "w-s", 실기: "w-p", 면접: "w-o", 수능: "w-c" };
export function WeightBar({ w }: { w: Record<Elem, number> | null }) {
  if (!w) return <span className="tiny">반영비율: 모집요강 확인</span>;
  return <div className="weights">{ELEMS.filter((k) => w[k] > 0).map((k) => <span key={k} className={WCLS[k]} style={{ width: `${w[k]}%` }}>{k} {w[k]}%</span>)}</div>;
}
export function FocusBar({ u }: { u: UnivTracks }) {
  const pct = u.susiPct ?? 0;
  return <div className="focus"><div className="row between small"><span>수시 <b className="num">{u.susi}</b>명</span><span className={`chip ${u.focus === "수시 위주" ? "t-fit" : u.focus === "정시 위주" ? "t-hope" : "plain"}`}>{u.focus}</span><span>정시 <b className="num">{u.jungsi}</b>명{u.carry ? " + 수시 이월" : ""}</span></div>
    <div className="split"><i style={{ width: `${pct}%` }} /></div>
    <span className="tiny">미술·디자인 계열 정원내 모집인원 기준 (특별전형 제외) · 수시 {pct}% : 정시 {100 - pct}%</span></div>;
}

function TrackRow({ t, byId, st, open }: { t: Track; byId: (id: string) => Program | undefined; st: Student; open: (id: string) => void }) {
  const [more, setMore] = useState(false);
  const js = t.ids.map(byId).filter((p): p is Program => !!p).map((p) => ({ p, j: judge(p, st) }));
  const cnt = Object.fromEntries(VS.map((v) => [v, js.filter((x) => x.j.verdict === v).length])) as Record<Verdict, number>;
  return <div className="trow">
    <div className="row between"><span><b className="small">{t.name}</b> <span className="chip plain">{t.round === "정시" ? `정시${t.kind ? `·${t.kind}` : ""}` : TRACK_CATS.find((c) => c.k === t.cat)?.label ?? t.cat}</span>{t.itv && <span className="chip plain">면접</span>}</span>
      <span className="tiny num">{t.quota ? `${t.quota}명` : t.carry ? "수시 이월" : "–"}</span></div>
    <WeightBar w={t.w} />
    <span className="tiny">{t.ratio || "반영비율 모집요강 확인"}{t.csat ? ` · 수능최저 ${t.csat}` : ""}{t.comp ? ` · 2026 경쟁률 ${t.comp}:1` : ""}{t.g70 || t.g50 ? ` · 등급컷 ${t.g50 ?? "–"}(50%)/${t.g70 ?? "–"}(70%)${t.rep ? `, ${t.rep} 기준` : ""}` : ""}</span>
    {t.limit && <span className="tiny warn-t">{t.limit}</span>}
    {js.length > 0 && <div className="row between"><Counts cnt={cnt} /><button className="linkbtn" onClick={() => setMore(!more)}>{more ? "접기" : `학과별 판정 ${js.length}`}</button></div>}
    {more && <div className="plist">{js.map(({ p, j }) => <button key={p.id} className="pick" onClick={() => open(p.id)}><span className="small">{p.dept}{p.quota ? <span className="tiny"> · {p.quota}명</span> : null}</span><span className={`chip ${VERDICT_STYLE[j.verdict].c}`}>{VERDICT_LABEL[j.verdict]}</span></button>)}</div>}
  </div>;
}

export function UnivTracksCard({ ukey, st, byId, open, compact }: { ukey: string; st: Student; byId: (id: string) => Program | undefined; open: (id: string) => void; compact?: boolean }) {
  const u = univTracks(ukey); const [show, setShow] = useState(!compact); const [rf, setRf] = useState<"수시" | "정시">("수시");
  if (!u) return null;
  const list = u.tracks.filter((t) => t.round === rf);
  return <div className="card"><div className="row between"><b>{ukey} 개설 전형</b><span className="tiny">2027 모집요강</span></div>
    <FocusBar u={u} />
    {compact && !show ? <button className="linkbtn" onClick={() => setShow(true)}>전형별 반영비율·모집인원 보기 ({u.tracks.length}개 전형) →</button> : <>
      <div className="seg" role="group" aria-label="수시·정시">{(["수시", "정시"] as const).map((r) => <button key={r} aria-pressed={rf === r} onClick={() => setRf(r)}>{r} {u.tracks.filter((t) => t.round === r).length}</button>)}</div>
      {list.length ? list.map((t, i) => <TrackRow key={t.name + i} t={t} byId={byId} st={st} open={open} />) : <div className="notice">{rf} 미술 계열 모집이 없어요.</div>}
      <span className="tiny">출처: 그린알다 2027 미대 {rf} 대학별 전형 (각 대학 모집요강·대학어디가 정리) · 원서 전 반드시 대학 모집요강 원문을 확인하세요.</span>
    </>}
  </div>;
}
