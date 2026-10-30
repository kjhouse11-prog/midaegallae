// v0.13 학원찾기 세밀화 — 전국 학원 검색(동 단위·정렬) · 학원 상세(목표 대학 맞춤 상담 질문·상담 노트) · 관심 학원 비교 · 학원 고르는 법
import { useEffect, useMemo, useState } from "react";
import { REGIONS } from "./lib/data";
import type { AuthUser, Profile } from "./lib/store";
import * as S from "./lib/store";
import {
  ACADEMY_CHECKLIST, ACADEMY_DATA_NOTE, ACADEMY_SOURCES, ACADEMY_TAGS, ACADEMY_TYPES, GRADE_ACADEMY_GUIDE, NOTE_RATES, REFUND_NOTE, REFUND_RULES,
  askList, dongOf, emptyNote, guguns, kakaoMapUrl, mapUrl, myTags, noteScore, perHour, rateAvg, reportUrl, type AcadNote, type Academy,
} from "./lib/academies";
import type { Program } from "./lib/engine";
import { useNativeBack } from "./lib/native";

const fname = (f: string) => f.replace("(게임)", " (게임)");
const wonK = (n: number) => `${n.toLocaleString()}원`;

// 전국 학원 목록 — 학원 탭을 열 때 한 번만 불러옴(별도 파일)
let cache: Academy[] | null = null;
function useAcademies() {
  const [all, setAll] = useState<Academy[] | null>(cache);
  useEffect(() => { if (!cache) import("./lib/academies.json").then((m) => { cache = m.default as Academy[]; setAll(cache); }); }, []);
  return all;
}
// 관심 학원·상담 노트 (이 기기 저장, 사용자별)
function useAcadStore(user: AuthUser) {
  const [fav, setFavS] = useState<string[]>(() => S.uget<string[]>(user, "acad-fav2", []));
  const [notes, setNotesS] = useState<Record<string, AcadNote>>(() => S.uget<Record<string, AcadNote>>(user, "acad-notes", {}));
  const toggleFav = (id: string) => { const x = fav.includes(id) ? fav.filter((y) => y !== id) : [...fav, id]; setFavS(x); S.uset(user, "acad-fav2", x); };
  const saveNote = (n: AcadNote | null, id: string) => { const x = { ...notes }; if (n) x[id] = n; else delete x[id]; setNotesS(x); S.uset(user, "acad-notes", x); if (n && !fav.includes(id)) toggleFav(id); };
  return { fav, toggleFav, notes, saveNote };
}

type Sort = "fit" | "name" | "note";
export function FindAcademy({ user, p, target, go }: { user: AuthUser; p: Profile; target?: Program; go: (t: string) => void }) {
  const all = useAcademies();
  const st = useAcadStore(user);
  const [q, setQ] = useState(""), [reg, setReg] = useState(p.regions.length ? "선호 지역" : "전국"), [gu, setGu] = useState(""), [dong, setDong] = useState(""), [tag, setTag] = useState(""), [n, setN] = useState(20), [onlyFav, setOnlyFav] = useState(false), [sort, setSort] = useState<Sort>("fit");
  const [chk, setChkS] = useState<number[]>(() => S.uget<number[]>(user, "acad-check", []));
  const toggleChk = (k: number) => { const x = chk.includes(k) ? chk.filter((y) => y !== k) : [...chk, k]; setChkS(x); S.uset(user, "acad-check", x); };
  const [showChk, setShowChk] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  useNativeBack(!!sel, () => setSel(null));
  const mine = myTags(p.track, p.field);
  const regions = reg === "선호 지역" ? p.regions : reg === "전국" ? [] : [reg];
  const gus = useMemo(() => (all && regions.length === 1 ? guguns(all, regions[0]) : []), [all, reg, p.regions]);
  const dongs = useMemo(() => (all && gu ? [...new Set(all.filter((a) => regions.includes(a.sido) && a.gugun === gu).map(dongOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")) : []), [all, gu, reg]);
  const list = useMemo(() => {
    if (!all) return [];
    const qq = q.replace(/\s/g, "");
    return all.filter((a) => (!regions.length || regions.includes(a.sido)) && (!gu || a.gugun === gu) && (!dong || dongOf(a) === dong) && (!tag || a.tags.includes(tag))
      && (!qq || (a.name + a.sido + a.gugun + a.addr + a.tags.join("")).replace(/\s/g, "").includes(qq)) && (!onlyFav || st.fav.includes(a.id)))
      .map((a) => ({ a, hit: a.tags.some((t) => mine.includes(t)), note: st.notes[a.id] }))
      .sort((x, y) => sort === "name" ? x.a.name.localeCompare(y.a.name, "ko")
        : sort === "note" ? Number(!!y.note) - Number(!!x.note) || (noteScore(y.note!) ?? 0) - (noteScore(x.note!) ?? 0)
        : Number(y.hit) - Number(x.hit) || (regions.length ? 0 : Number(p.regions.includes(y.a.sido)) - Number(p.regions.includes(x.a.sido))));
  }, [all, q, reg, gu, dong, tag, onlyFav, st.fav, st.notes, sort, p]);
  const reset = () => setN(20);

  const cur = sel && all ? all.find((a) => a.id === sel) : undefined;
  if (cur) return <AcademyDetail a={cur} all={all!} p={p} target={target} st={st} back={() => setSel(null)} open={(id) => { setSel(id); window.scrollTo(0, 0); }} go={go} />;
  return <>
    <div className="card"><b>전국 입시미술학원 찾기</b>
      <span className="small">{ACADEMY_DATA_NOTE} · <b>{all ? all.length.toLocaleString() : "…"}곳</b></span>
      <span className="small">현재 프로필: <b>{p.grade} · {p.track.replace(" 계열", "")} · {fname(p.field)}</b> · 선호 지역 {p.regions.length ? p.regions.join("·") : "전국"}{target ? <> · 목표 <b>{target.univ} {target.dept}</b></> : null}</span>
      <span className="tiny">{mine.length ? `학원명에 '${mine.join("·")}' 분야가 드러난 학원을 먼저 보여 줘요. ` : ""}학원을 누르면 {target ? "목표 대학에 맞춘 " : ""}상담 질문과 상담 노트가 나와요. 대부분의 입시미술학원은 여러 분야 반을 함께 운영하니 개설 분야·교습비는 전화 상담으로 확인하세요.</span>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}><button className="btn line" onClick={() => go("me")}>내 프로필 수정</button><button className="btn line" onClick={() => setShowChk(!showChk)}>학원 선택 체크리스트 {chk.length}/{ACADEMY_CHECKLIST.length}</button></div>
      {showChk && <ul className="checks">{ACADEMY_CHECKLIST.map((c, k) => <li key={k} className={chk.includes(k) ? "done" : ""}><label><input type="checkbox" checked={chk.includes(k)} onChange={() => toggleChk(k)} /><span className="tx small">{c}</span></label></li>)}</ul>}
    </div>
    <div className="card"><b>학원 검색</b>
      <input className="search" placeholder="학원명, 동네(동·구), 도로명 검색" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} aria-label="학원 검색" />
      <div className="filters">
        <select aria-label="지역" value={reg} onChange={(e) => { setReg(e.target.value); setGu(""); setDong(""); reset(); }}>{p.regions.length > 0 && <option>선호 지역</option>}<option>전국</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
        {gus.length > 0 && <select aria-label="구·군" value={gu} onChange={(e) => { setGu(e.target.value); setDong(""); reset(); }}><option value="">구·군 전체</option>{gus.map((g) => <option key={g}>{g}</option>)}</select>}
        {dongs.length > 1 && <select aria-label="동·읍·면" value={dong} onChange={(e) => { setDong(e.target.value); reset(); }}><option value="">동 전체</option>{dongs.map((g) => <option key={g}>{g}</option>)}</select>}
        <select aria-label="분야" value={tag} onChange={(e) => { setTag(e.target.value); reset(); }}><option value="">모든 분야</option>{ACADEMY_TAGS.map((t) => <option key={t} value={t}>{t} 전문</option>)}</select>
        <select aria-label="보기" value={onlyFav ? "fav" : "all"} onChange={(e) => { setOnlyFav(e.target.value === "fav"); reset(); }}><option value="all">모든 학원</option><option value="fav">관심 학원 ({st.fav.length})</option></select>
        <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="fit">내 분야 먼저</option><option value="name">이름순</option><option value="note">상담 노트 점수순</option></select>
      </div>
      {regions.length > 1 && <span className="tiny">구·군·동으로 좁히려면 지역을 한 곳만 고르세요.</span>}
      <span className="tiny">{all ? `${list.length.toLocaleString()}곳` : "학원 목록을 불러오는 중…"}{regions.length ? ` · ${regions.join("·")}${gu ? " " + gu : ""}${dong ? " " + dong : ""}` : " · 전국"}</span>
    </div>
    {list.slice(0, n).map(({ a, hit, note }) => { const sc = note ? noteScore(note) : null; return <button key={a.id} className="card-btn" onClick={() => { setSel(a.id); window.scrollTo(0, 0); }}><div className="card acad">
      <div className="row between"><span className="name">{st.fav.includes(a.id) ? "★ " : ""}{a.name}</span><span>{hit && <span className="chip t-fit">내 분야</span>}{note && <span className="chip plain" style={{ marginLeft: 4 }}>상담 {sc != null ? `${sc}점` : "기록"}</span>}</span></div>
      <div className="small muted">{a.sido} {a.gugun}{dongOf(a) ? ` ${dongOf(a)}` : ""}{a.tel ? ` · ${a.tel}` : ""}</div>
      {a.tags.length > 0 && <div className="tags">{a.tags.map((x) => <span key={x} className={mine.includes(x) ? "on" : ""}>{x}</span>)}</div>}
    </div></button>; })}
    {all && !list.length && <div className="notice">조건에 맞는 학원이 없어요. 지역을 '전국'으로 바꾸거나 검색어·분야를 지워 보세요.</div>}
    {list.length > n && <button className="btn line block" onClick={() => setN(n + 40)}>{Math.min(40, list.length - n)}곳 더 보기 (남은 {list.length - n}곳)</button>}
    <div className="card"><b>공개 자료로 학원 정보 확인</b>
      {ACADEMY_SOURCES.map((s) => <a key={s.url} className="srclink" href={s.url} target="_blank" rel="noopener"><b className="small">{s.name}</b><span className="tiny">{s.note}</span></a>)}
      <span className="tiny">이 목록은 학원의 현재 운영·수업·가격을 보증하지 않아요. 이전·폐원했을 수 있으니 방문 전에 전화로 확인하세요.</span>
    </div>
  </>;
}

type St = ReturnType<typeof useAcadStore>;
function AcademyDetail({ a, all, p, target, st, back, open, go }: { a: Academy; all: Academy[]; p: Profile; target?: Program; st: St; back: () => void; open: (id: string) => void; go: (t: string) => void }) {
  const [edit, setEdit] = useState(false);
  const note = st.notes[a.id];
  const [asked, setAsked] = useState<number[]>([]);
  const qs = askList({ grade: p.grade, field: p.field, track: p.track, target });
  const near = all.filter((x) => x.id !== a.id && x.sido === a.sido && x.gugun === a.gugun && (dongOf(x) === dongOf(a) || !dongOf(a))).slice(0, 6);
  const nearGu = near.length ? near : all.filter((x) => x.id !== a.id && x.sido === a.sido && x.gugun === a.gugun).slice(0, 6);
  return <>
    <button className="back" onClick={back}>← 학원 목록</button>
    <div><h1 className="page" style={{ fontSize: 24 }}>{a.name}</h1><div className="small muted">{a.sido} {a.gugun}{dongOf(a) ? ` ${dongOf(a)}` : ""}</div>
      {a.tags.length > 0 && <div className="tags" style={{ marginTop: 6 }}>{a.tags.map((x) => <span key={x} className="on">{x} 전문</span>)}</div>}</div>
    <div className="card">
      <dl className="kv"><dt>주소</dt><dd>{a.addr}{a.zip ? <span className="tiny"> ({a.zip})</span> : null}</dd>
        <dt>전화</dt><dd>{a.tel ? <a href={`tel:${a.tel.replace(/-/g, "")}`}>{a.tel}</a> : <span className="tiny">공개 번호 없음 · 나이스 학원민원서비스에서 확인</span>}</dd></dl>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {a.tel && <a className="btn" href={`tel:${a.tel.replace(/-/g, "")}`}>전화 상담</a>}
        <a className="btn line" href={mapUrl(a)} target="_blank" rel="noopener">네이버 지도</a>
        <a className="btn line" href={kakaoMapUrl(a)} target="_blank" rel="noopener">카카오맵</a>
        <button className="btn line" onClick={() => st.toggleFav(a.id)}>{st.fav.includes(a.id) ? "★ 관심 학원" : "☆ 관심 학원"}</button>
      </div>
    </div>
    <div className="card"><b>상담 때 이것부터 물어보세요</b>
      <span className="tiny">{target ? `목표 ${target.univ} ${target.dept} · ` : ""}{p.grade} · {fname(p.field)} 기준으로 골랐어요. 물어본 질문은 눌러서 표시하세요.</span>
      <ul className="checks">{qs.map((x, k) => <li key={k} className={asked.includes(k) ? "done" : ""}><label><input type="checkbox" checked={asked.includes(k)} onChange={() => setAsked(asked.includes(k) ? asked.filter((y) => y !== k) : [...asked, k])} /><span className="tx small">{x}</span></label></li>)}</ul>
      {!target && <button className="linkbtn tiny" onClick={() => go("match")}>대학찾기에서 목표 대학 정하기 →</button>}
    </div>
    {edit ? <NoteForm init={note || emptyNote(a.id)} onSave={(n) => { st.saveNote(n, a.id); setEdit(false); }} onCancel={() => setEdit(false)} onDelete={note ? () => { st.saveNote(null, a.id); setEdit(false); } : undefined} />
      : note ? <NoteView n={note} onEdit={() => setEdit(true)} />
      : <div className="card"><b>상담 노트</b><span className="small muted">상담·체험 수업 뒤 교습비·수업 시간·반 인원·통학 시간과 느낌을 적어 두면, 관심 학원끼리 점수로 비교할 수 있어요. 이 기기에만 저장돼요.</span><button className="btn block" onClick={() => setEdit(true)}>상담 노트 쓰기</button></div>}
    {nearGu.length > 0 && <div className="card"><b>{dongOf(a) && near.length ? `${dongOf(a)} 주변` : a.gugun} 다른 학원</b>
      <div className="plist">{nearGu.map((x) => <button key={x.id} className="pick" onClick={() => open(x.id)}><span className="small">{x.name}</span><span className="tiny">{dongOf(x) || x.gugun}</span></button>)}</div></div>}
    <div className="card"><span className="tiny">정보가 바뀌었나요? (이전·폐원·전화번호·전문 분야)</span><a className="linkbtn small" href={reportUrl(a)} target="_blank" rel="noopener">학원 정보 수정 요청하기 ↗</a></div>
  </>;
}

const numOr = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v)) || 0);
function NoteForm({ init, onSave, onCancel, onDelete }: { init: AcadNote; onSave: (n: AcadNote) => void; onCancel: () => void; onDelete?: () => void }) {
  const [n, setN] = useState<AcadNote>(init);
  const set = <K extends keyof AcadNote>(k: K, v: AcadNote[K]) => setN({ ...n, [k]: v });
  const num = (k: "fee" | "extra" | "hours" | "size" | "commute", label: string, unit: string, ph: string) =>
    <label className="f"><span className="tiny">{label} ({unit})</span><input inputMode="numeric" value={n[k] ?? ""} placeholder={ph} onChange={(e) => set(k, numOr(e.target.value.replace(/[^0-9.]/g, "")))} /></label>;
  return <div className="card"><b>상담 노트 {init.fee != null || init.memo ? "고치기" : "쓰기"}</b>
    <label className="f"><span className="tiny">상담일</span><input type="date" value={n.on} onChange={(e) => set("on", e.target.value)} /></label>
    <div className="grid2">{num("fee", "월 교습비", "만 원", "예: 60")}{num("extra", "재료비·특강비 등 월 별도", "만 원", "예: 5")}{num("hours", "주당 수업 시간", "시간", "예: 12")}{num("size", "반 인원", "명", "예: 12")}{num("commute", "편도 통학", "분", "예: 25")}
      <label className="f"><span className="tiny">담당 강사</span><select value={n.teacher} onChange={(e) => set("teacher", e.target.value as AcadNote["teacher"])}><option value="">선택</option><option>원장 직강</option><option>전담 강사</option><option>강사 여러 명</option></select></label></div>
    <label className="check"><input type="checkbox" checked={n.trial} onChange={(e) => set("trial", e.target.checked)} /><span>체험 수업을 받아 봤어요</span></label>
    <label className="f"><span className="tiny">들은 합격 실적 (학과별로)</span><input value={n.record} placeholder="예: 작년 홍대 디자인 3명, 국민대 2명" onChange={(e) => set("record", e.target.value)} /></label>
    <span className="tiny">평가 (1~5점)</span>
    {NOTE_RATES.map((k) => <div className="row between" key={k}><span className="small">{k}</span><span className="rate" role="radiogroup" aria-label={k}>{[1, 2, 3, 4, 5].map((v) => <button key={v} role="radio" aria-checked={n.rate[k] === v} className={(n.rate[k] || 0) >= v ? "on" : ""} onClick={() => set("rate", { ...n.rate, [k]: v })}>★</button>)}</span></div>)}
    <label className="f"><span className="tiny">메모</span><textarea rows={3} value={n.memo} placeholder="강평 방식, 시험 기간 수업 조정, 분위기 등" onChange={(e) => set("memo", e.target.value)} /></label>
    <div className="row" style={{ gap: 8 }}><button className="btn line" onClick={onCancel}>취소</button><button className="btn" onClick={() => onSave(n)}>저장</button>{onDelete && <button className="linkbtn tiny" onClick={onDelete}>노트 삭제</button>}</div>
  </div>;
}
function NoteView({ n, onEdit }: { n: AcadNote; onEdit: () => void }) {
  const ph = perHour(n), sc = noteScore(n), r = rateAvg(n);
  return <div className="card"><div className="row between"><b>상담 노트 · {n.on}</b>{sc != null && <span className="chip t-fit">비교 점수 {sc}</span>}</div>
    <dl className="kv">
      {n.fee != null && <><dt>교습비</dt><dd>월 {n.fee}만 원{n.extra ? ` + 별도 ${n.extra}만 원` : ""}</dd></>}
      {n.hours != null && <><dt>수업</dt><dd>주 {n.hours}시간{ph ? <span className="tiny"> · 시간당 약 {wonK(ph)}</span> : null}</dd></>}
      {n.size != null && <><dt>반 인원</dt><dd>{n.size}명</dd></>}
      {n.commute != null && <><dt>통학</dt><dd>편도 {n.commute}분{n.commute >= 30 ? <span className="tiny"> · 왕복 주 {Math.round((n.commute * 2 * (n.hours ? Math.max(2, Math.round(n.hours / 3)) : 3)) / 60)}시간</span> : null}</dd></>}
      {n.teacher && <><dt>강사</dt><dd>{n.teacher}</dd></>}
      <dt>체험 수업</dt><dd>{n.trial ? "받음" : "아직"}</dd>
      {n.record && <><dt>합격 실적</dt><dd>{n.record}</dd></>}
      {r != null && <><dt>평가</dt><dd>{NOTE_RATES.filter((k) => n.rate[k]).map((k) => `${k} ${n.rate[k]}`).join(" · ")} (평균 {r})</dd></>}
      {n.memo && <><dt>메모</dt><dd>{n.memo}</dd></>}
    </dl>
    <span className="tiny">비교 점수 = 평가 50 + 시간당 비용 20 + 반 인원 15 + 통학 15 (입력한 항목만 환산)</span>
    <button className="btn line" onClick={onEdit}>고치기</button></div>;
}

// ---------- 관심 학원 비교 ----------
export function CompareAcademies({ user, go }: { user: AuthUser; go: (sub: string) => void }) {
  const all = useAcademies();
  const st = useAcadStore(user);
  if (!all) return <div className="loading">불러오는 중…</div>;
  const rows = st.fav.map((id) => all.find((a) => a.id === id)).filter((a): a is Academy => !!a).map((a) => ({ a, n: st.notes[a.id], sc: st.notes[a.id] ? noteScore(st.notes[a.id]) : null }))
    .sort((x, y) => (y.sc ?? -1) - (x.sc ?? -1));
  if (!rows.length) return <div className="card"><b>관심 학원 비교</b><span className="small muted">학원 찾기에서 ☆ 관심 학원을 누르거나 상담 노트를 쓰면 여기에서 나란히 비교할 수 있어요.</span><button className="btn" onClick={() => go("find")}>학원 찾으러 가기</button></div>;
  const withNote = rows.filter((r) => r.n);
  const best = (f: (n: AcadNote) => number | null, low: boolean) => { const v = withNote.map((r) => f(r.n!)).filter((x): x is number => x != null); return v.length > 1 ? (low ? Math.min(...v) : Math.max(...v)) : null; };
  const bPh = best(perHour, true), bSize = best((n) => n.size, true), bCm = best((n) => n.commute, true), bR = best(rateAvg, false);
  const cell = (v: number | null, b: number | null, s: string) => <td className={v != null && v === b ? "best" : ""}>{v == null ? "–" : s}</td>;
  return <>
    <p className="lead">관심 학원 {rows.length}곳 · 상담 노트 {withNote.length}곳. 상담 노트를 쓴 학원은 비교 점수 순으로, 항목별 가장 좋은 값은 굵게 표시해요.</p>
    {withNote.length > 0 && <div className="card" style={{ overflowX: "auto" }}><table className="cmp">
      <thead><tr><th>학원</th><th>점수</th><th>월 비용</th><th>시간당</th><th>주 시간</th><th>반</th><th>통학</th><th>평가</th></tr></thead>
      <tbody>{withNote.map(({ a, n, sc }) => <tr key={a.id}><th>{a.name.replace(/미술학원$/, "")}</th><td><b>{sc ?? "–"}</b></td><td>{n!.fee != null ? `${n!.fee + (n!.extra || 0)}만` : "–"}</td>
        {cell(perHour(n!), bPh, perHour(n!) ? `${(perHour(n!)! / 10000).toFixed(1)}만` : "")}<td>{n!.hours ?? "–"}</td>{cell(n!.size, bSize, `${n!.size}명`)}{cell(n!.commute, bCm, `${n!.commute}분`)}{cell(rateAvg(n!), bR, `${rateAvg(n!)}`)}</tr>)}</tbody></table>
      <span className="tiny">시간당 = (월 교습비 + 별도 비용) ÷ (주당 시간 × 4.3주)</span></div>}
    {rows.map(({ a, n, sc }) => <div className="card acad" key={a.id}><div className="row between"><span className="name">{a.name}</span>{sc != null ? <span className="chip t-fit">{sc}점</span> : <span className="chip plain">노트 없음</span>}</div>
      <span className="small muted">{a.sido} {a.gugun}{dongOf(a) ? ` ${dongOf(a)}` : ""}{a.tel ? ` · ${a.tel}` : ""}</span>
      {n?.record && <span className="tiny">합격 실적: {n.record}</span>}
      <div className="row between tiny">{a.tel ? <a className="linkbtn" href={`tel:${a.tel.replace(/-/g, "")}`}>전화</a> : <span />}<button className="linkbtn" onClick={() => st.toggleFav(a.id)}>관심 해제</button></div></div>)}
  </>;
}

// ---------- 학원 고르는 법 ----------
export function AcademyGuide({ p }: { p: Profile }) {
  const g = GRADE_ACADEMY_GUIDE[p.grade] || GRADE_ACADEMY_GUIDE["고2"];
  return <>
    <div className="card"><b>{p.grade} 학원 다니는 법</b><span className="chip t-fit" style={{ alignSelf: "flex-start" }}>{g.when}</span><ul className="list small">{g.how.map((x) => <li key={x}>{x}</li>)}</ul>
      <span className="tiny">다른 학년 보기: {Object.keys(GRADE_ACADEMY_GUIDE).filter((k) => k !== p.grade).map((k) => `${k} — ${GRADE_ACADEMY_GUIDE[k].when}`).join(" / ")}</span></div>
    <h2 className="sec">학원 유형별 특징</h2>
    {ACADEMY_TYPES.map((t) => <div className="card" key={t.name}><b className="small">{t.name}</b><span className="small">{t.fit}</span><span className="tiny">확인할 점: {t.watch}</span></div>)}
    <h2 className="sec">교습비 환불 기준 (학원법)</h2>
    <div className="card"><table className="cmp"><thead><tr><th>그만둔 시점 (1개월 과정)</th><th>돌려받는 금액</th></tr></thead><tbody>{REFUND_RULES.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
      <span className="tiny">{REFUND_NOTE}</span></div>
    <h2 className="sec">상담 체크리스트</h2>
    <div className="card"><ul className="list small">{ACADEMY_CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul></div>
  </>;
}
