import { useEffect, useState, type ReactNode } from "react";
import { AXES } from "./lib/data";

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
