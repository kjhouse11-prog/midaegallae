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
