import { useEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { AXES } from "./lib/data";
import { ADS, MGOOD_URL, type Ad } from "./lib/ads";

export function Radar({ scores, size = 220 }: { scores: Record<string, number | null>; size?: number }) {
  const c = size / 2, r = size / 2 - 34, n = AXES.length;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v]; };
  const ring = (k: number) => AXES.map((_, i) => pt(i, k).join(",")).join(" ");
  const vals = AXES.map((a, i) => pt(i, (scores[a] ?? 0) / 100).join(",")).join(" ");
  return (
    <svg className="radar" viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size + 40, alignSelf: "center" }} role="img" aria-label="항목별 점수 레이더 차트">
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={ring(k)} fill="none" stroke="var(--line)" />)}
      <polygon points={vals} fill="var(--accent)" fillOpacity={0.18} stroke="var(--accent)" strokeWidth={2} />
      {AXES.map((a, i) => { const [x, y] = pt(i, 1.22); const s = scores[a]; return <text key={a} x={x} y={y + 4} textAnchor="middle">{a} {s == null ? "–" : s}</text>; })}
    </svg>
  );
}

// 반영 요소별 '내 위치' 막대: 가운데 선 = 이 학과 기준, 오른쪽일수록 여유
export function PartBar({ k, w, mine, need, margin }: { k: string; w: number; mine: string; need: string; margin: number }) {
  const pos = Math.max(4, Math.min(96, 50 + margin * 15));
  return (
    <div className="part">
      <div className="row between small"><b>{k} <span className="tiny">반영 {w}%</span></b><span className={margin >= 0 ? "ok" : "short"}>{margin >= 0 ? "여유" : "부족"}</span></div>
      <div className="bar2" aria-label={`${k}: 나 ${mine}, 기준 ${need}`}><span className="mid" /><i style={{ left: `${pos}%` }} /></div>
      <div className="row between tiny"><span>나 {mine}</span><span>기준 {need}</span></div>
    </div>
  );
}

const icons: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  works: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM21 16l-5-5-9 9",
  match: "M3 9 12 4l9 5-9 5zM7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5",
  road: "M4 19c4 0 4-6 8-6s4-6 8-6",
  plan: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4M8 15l2.5 2.5L16 13",
  acad: "M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5M10 12h4",
  mentor: "M8 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 20c.8-3 3.2-5 6-5s5.2 2 6 5M14 4h7v6h-3l-2 2v-2h-2z",
  me: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
};
export function Icon({ name }: { name: string }) { return <svg viewBox="0 0 24 24"><path d={icons[name]} /></svg>; }

// 숫자 입력칸 — 입력 중에는 칸을 비우거나 자유롭게 고칠 수 있고, 칸을 벗어날 때 범위(min~max)로 맞춤.
// (type="number"에 값을 바로 넣으면 지운 칸이 다시 1로 채워져 "12"처럼 입력되는 문제가 있었음)
export function NumInput({ id, value, min, max, allowEmpty, placeholder, onCommit }: {
  id?: string; value: number | null; min: number; max: number; allowEmpty?: boolean; placeholder?: string;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(value === null ? "" : String(value)); }, [value, focus]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return <input id={id} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={text}
    onFocus={(e) => { setFocus(true); e.currentTarget.select(); }}
    onChange={(e) => {
      const t = e.target.value.replace(",", ".");
      if (!/^\d*\.?\d*$/.test(t)) return;
      setText(t);
      const n = parseFloat(t);
      if (t === "") { if (allowEmpty) onCommit(null); }
      else if (!isNaN(n) && n >= min && n <= max) onCommit(n);
    }}
    onBlur={() => {
      setFocus(false);
      const n = parseFloat(text);
      if (text === "" || isNaN(n)) { if (allowEmpty) { onCommit(null); setText(""); } else setText(value === null ? "" : String(value)); return; }
      const c = clamp(n); onCommit(c); setText(String(c));
    }} />;
}

// 홈 화면 설치 안내 — 이미 설치된 앱으로 열면 숨김.
// · 크롬 등 설치 이벤트가 오면 [설치] 버튼 한 번
// · 카카오톡·네이버·앱 안 브라우저는 설치가 막혀 있어 [크롬으로 열기]
// · 그 밖(삼성 인터넷, 이벤트가 아직 안 온 크롬, 아이폰 사파리)은 메뉴 안내
export function InstallBar() {
  const ua = navigator.userAgent;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|; wv\)|Claude/i.test(ua);
  const samsung = /SamsungBrowser/i.test(ua);
  const [bip, setBip] = useState<any>((window as any).__bip ?? null);
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem("install-bar-off") === "1"; } catch { return false; } });
  const [done, setDone] = useState(false);
  useEffect(() => {
    const on = () => setBip((window as any).__bip ?? null);
    const ok = () => { setDone(true); (window as any).__bip = null; setBip(null); };
    window.addEventListener("bip-ready", on); window.addEventListener("appinstalled", ok);
    return () => { window.removeEventListener("bip-ready", on); window.removeEventListener("appinstalled", ok); };
  }, []);
  if (standalone || hidden || done || (!ios && !android && !bip)) return null;
  const close = () => { setHidden(true); try { sessionStorage.setItem("install-bar-off", "1"); } catch { /* 무시 */ } };
  const here = location.href.replace(/^https?:\/\//, "");
  let msg: string, action: ReactNode = null;
  if (bip) {
    msg = "홈 화면에 아이콘을 만들어 바로 열어요";
    action = <button className="btn" onClick={async () => { bip.prompt(); const r = await bip.userChoice; if (r?.outcome === "accepted") setDone(true); (window as any).__bip = null; setBip(null); }}>설치</button>;
  } else if (inApp && android) {
    msg = "이 화면에서는 설치가 안 돼요. 크롬으로 열어 설치하세요";
    action = <a className="btn" href={`intent://${here}#Intent;scheme=https;package=com.android.chrome;end`}>크롬으로 열기</a>;
  } else if (inApp && ios) {
    msg = "오른쪽 아래 ··· 또는 공유 → 'Safari로 열기' 후 설치하세요";
  } else if (ios) {
    msg = "아래 공유 버튼(□↑) → '홈 화면에 추가'를 누르세요";
  } else if (samsung) {
    msg = "아래 메뉴(≡) → '현재 페이지 추가' → '홈 화면'을 누르세요";
  } else {
    msg = "오른쪽 위 메뉴(⋮) → '홈 화면에 추가' 또는 '앱 설치'를 누르세요";
  }
  return <div className="install-bar" role="region" aria-label="앱 설치">
    <img src="./icon-192.png" alt="" width={40} height={40} />
    <div className="t"><b>미대갈래 앱 설치</b><span>{msg}</span></div>
    {action}
    <button className="x" aria-label="닫기" onClick={close}>×</button>
  </div>;
}

// 하단 광고 배너 — 광고 목록(lib/ads.ts)을 8초 영상 한 편씩 차례로 소리 없이 재생.
// 화면을 옮겨도 다음 광고부터 이어서 나오도록 순번을 모듈에 보관.
// 손가락(마우스)으로 좌우로 끌면 이전·다음 광고로 넘어감. 끈 직후의 누름은 링크로 처리하지 않음.
let adTurn = 0;
export function AdBanner() {
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [i, setI] = useState(() => adTurn % ADS.length);
  const [info, setInfo] = useState<Ad | null>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const next = () => { adTurn = (adTurn + 1) % ADS.length; setI(adTurn); };
  const prev = () => { adTurn = (adTurn - 1 + ADS.length) % ADS.length; setI(adTurn); };
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const swiped = useRef(false);
  const onDown = (e: RPointerEvent) => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }; swiped.current = false; };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.moved) { if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my)) return; d.moved = true; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* 무시 */ } }
    setDx(mx);
  };
  const onUp = (e: RPointerEvent) => {
    const d = drag.current; drag.current = null; if (!d || d.id !== e.pointerId) return;
    if (d.moved) { swiped.current = true; const w = (e.currentTarget as HTMLElement).offsetWidth || 300; const mx = e.clientX - d.x; if (mx <= -w * 0.18) next(); else if (mx >= w * 0.18) prev(); }
    setDx(0);
  };
  const onCancel = () => { drag.current = null; setDx(0); };
  // 끌어서 넘긴 직후 발생하는 click은 막아 링크·안내창이 뜨지 않게
  const onClickCap = (e: RMouseEvent) => { if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; } };
  // 일부 폰 브라우저는 muted 속성이 확실히 붙어 있어야 자동 재생됨
  useEffect(() => { const v = ref.current; if (!v) return; v.muted = true; v.play().catch(() => {}); }, [i]);
  // 정지 이미지 모드는 8초마다, 영상은 끝나면 넘어감. 자동 재생이 막힌 기기(절전 모드 등)도 10초 뒤 넘어가도록 안전장치
  // 끄는 중에는 자동으로 넘어가지 않음
  useEffect(() => { if (dx) return; const t = setTimeout(next, still ? 8000 : 10000); return () => clearTimeout(t); }, [i, still, dx !== 0]);
  const ad = ADS[i];
  const media = still ? <img src={ad.poster} alt="" /> :
    <video key={ad.id} ref={ref} poster={ad.poster} autoPlay muted playsInline preload="auto" aria-hidden="true" onEnded={next}><source src={ad.mp4} type="video/mp4" /><source src={ad.webm} type="video/webm" onError={next} /></video>;
  const dots = <span className="ad-dots" aria-hidden="true">{ADS.map((a, k) => <i key={a.id} className={k === i ? "on" : ""} />)}</span>;
  const style = dx ? { transform: `translateX(${dx}px)` } : undefined;
  return <>
    <div className={`ad-track${dx ? " dragging" : ""}`} role="region" aria-roledescription="광고 슬라이드" aria-label={`광고 ${i + 1}/${ADS.length} · 좌우로 넘기기`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onClickCapture={onClickCap} onDragStart={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); }}>
    {ad.url && !ad.sample
      ? <a className="ad-banner" style={style} href={ad.url} target="_blank" rel="noopener" draggable={false} aria-label={`${ad.name} 바로가기 (광고)`}>{media}{dots}</a>
      : <button type="button" className="ad-banner" style={style} onClick={() => setInfo(ad)} aria-label={`${ad.name} (샘플 광고)`}>{media}{dots}</button>}
    </div>
    {info && <div className="ad-sheet" role="dialog" aria-modal="true" aria-label="샘플 광고 안내" onClick={() => setInfo(null)}>
      <div className="ad-sheet-box" onClick={(e) => e.stopPropagation()}>
        <span className="pill">베타 · 샘플 광고</span>
        <b>{info.name}</b>
        <p className="small">미대갈래 하단 광고가 어떻게 보이는지 보여 드리기 위해 만든 가상의 {info.kind} 광고예요. 실제 서비스에서는 이 자리를 누르면 광고주의 홈페이지나 접수 페이지로 연결됩니다.</p>
        <a className="btn block" href={MGOOD_URL} target="_blank" rel="noopener">광고 문의 · 월간 미대입시</a>
        <button type="button" className="linkbtn" onClick={() => setInfo(null)}>닫기</button>
      </div>
    </div>}
  </>;
}
