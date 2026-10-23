// v0.10 멘토 매칭 저장 계층
// · Supabase 설정 + migrate_v0.10.sql 실행 → 서버에 저장 (이용자·조언자·운영자가 서로 다른 폰에서 함께 씀)
// · 데모 모드 또는 migrate_v0.10.sql 실행 전 → 이 기기에 저장. 한 기기에서 계정을 바꿔 로그인하면 이용자·조언자·운영자 역할을 모두 시험할 수 있음
import { sb, type AuthUser } from "./store";
import { ADMIN_EMAILS } from "../config";
import { DEFAULT_SETTINGS, SAMPLE_MENTORS, SAMPLE_REVIEWS, rid, type AdviceReq, type Att, type Mentor, type MentorDoc, type Payout, type Report, type Review, type Settings } from "./mentor";

export interface Market { mentors: Mentor[]; reqs: AdviceReq[]; payouts: Payout[]; reports: Report[]; reviews: Review[]; settings: Settings; server: boolean; admin: boolean }

const LK = "midae-market-v1";
type Local = { mentors: Mentor[]; reqs: AdviceReq[]; payouts: Payout[]; reports: Report[]; reviews: Review[]; settings: Settings };
const empty = (): Local => ({ mentors: [], reqs: [], payouts: [], reports: [], reviews: [], settings: DEFAULT_SETTINGS });
const lread = (): Local => { try { return { ...empty(), ...(JSON.parse(localStorage.getItem(LK) || "") as Local) }; } catch { return empty(); } };
const lwrite = (d: Local) => { try { localStorage.setItem(LK, JSON.stringify(d)); } catch { throw new Error("기기 저장 공간이 부족해요. 첨부 파일 크기를 줄여 주세요."); } };
const upsertBy = <T extends { id: string }>(xs: T[], x: T) => [x, ...xs.filter((y) => y.id !== x.id)];

// 서버 테이블이 아직 없으면(마이그레이션 전) 이 기기 저장으로 전환
let serverOff = !sb;
const missing = (m: string) => /does not exist|schema cache|PGRST20|42P01|relation/i.test(m);

export async function loadMarket(u: AuthUser): Promise<Market> {
  if (sb && !serverOff) {
    const [m, mp, r, p, rp, rv, st, ad] = await Promise.all([
      sb.from("mentors").select("data,status"), sb.from("mentor_private").select("id,data"), sb.from("advice_requests").select("data,status"), sb.from("payouts").select("data,status"),
      sb.from("reports").select("data,status"), sb.from("mentor_reviews").select("data"), sb.from("app_settings").select("data").eq("id", 1).maybeSingle(), sb.from("admins").select("user_id").eq("user_id", u.id).maybeSingle(),
    ]);
    const err = [m, mp, r, p, rp, rv, st].find((x) => x.error)?.error;
    if (err && missing(err.message)) serverOff = true;
    else if (err) throw new Error("멘토 매칭 정보를 불러오지 못했어요: " + err.message);
    else {
      const priv = new Map((mp.data || []).map((x) => [x.id as string, x.data as Pick<Mentor, "docs" | "bank" | "docLog">]));
      const mentors = (m.data || []).map((x) => ({ ...(x.data as Mentor), status: x.status, docs: [], ...(priv.get((x.data as Mentor).id) || {}) }) as Mentor);
      return {
        mentors: [...mentors, ...SAMPLE_MENTORS], reqs: (r.data || []).map((x) => ({ ...(x.data as AdviceReq), status: x.status })), payouts: (p.data || []).map((x) => ({ ...(x.data as Payout), status: x.status })),
        reports: (rp.data || []).map((x) => ({ ...(x.data as Report), status: x.status })), reviews: [...(rv.data || []).map((x) => x.data as Review), ...SAMPLE_REVIEWS],
        settings: { ...DEFAULT_SETTINGS, ...((st.data?.data as Settings) || {}) }, server: true, admin: !!ad.data || ADMIN_EMAILS.includes(u.email.toLowerCase()),
      };
    }
  }
  const d = lread();
  return { ...d, mentors: [...d.mentors, ...SAMPLE_MENTORS], reviews: [...d.reviews, ...SAMPLE_REVIEWS], server: false, admin: true };
}

async function sbUpsert(table: string, row: Record<string, unknown>) {
  const { error } = await sb!.from(table).upsert(row);
  if (error) throw new Error("저장하지 못했어요: " + error.message);
}
export async function saveMentor(m: Mentor): Promise<void> {
  if (m.sample) return;
  if (sb && !serverOff) {
    const { docs, bank, docLog, ...pub } = m;
    await sbUpsert("mentors", { id: m.id, status: m.status, data: pub, updated_at: new Date().toISOString() });
    await sbUpsert("mentor_private", { id: m.id, data: { docs, bank, docLog } });
    return;
  }
  const d = lread(); d.mentors = upsertBy(d.mentors, m); lwrite(d);
}
export async function saveReq(r: AdviceReq): Promise<void> {
  if (sb && !serverOff) return sbUpsert("advice_requests", { id: r.id, student_id: r.studentId, mentor_id: r.mentorId || null, target_mentor_id: r.targetMentorId || null, status: r.status, mode: r.mode, field: r.field, kind: r.kind, univ: r.univ, data: r, updated_at: new Date().toISOString() });
  const d = lread(); d.reqs = upsertBy(d.reqs, r); lwrite(d);
}
export async function savePayout(p: Payout): Promise<void> {
  if (sb && !serverOff) return sbUpsert("payouts", { id: p.id, mentor_id: p.mentorId, status: p.status, data: p });
  const d = lread(); d.payouts = upsertBy(d.payouts, p); lwrite(d);
}
export async function saveReport(x: Report): Promise<void> {
  if (sb && !serverOff) return sbUpsert("reports", { id: x.id, by_id: x.byId, status: x.status, data: x });
  const d = lread(); d.reports = upsertBy(d.reports, x); lwrite(d);
}
export async function saveReview(x: Review & { byId: string }): Promise<void> {
  if (sb && !serverOff) return sbUpsert("mentor_reviews", { req_id: x.reqId, mentor_id: x.mentorId, by_id: x.byId, data: x });
  const d = lread(); d.reviews = [x, ...d.reviews.filter((y) => y.reqId !== x.reqId)]; lwrite(d);
}
export async function saveSettings(s: Settings): Promise<void> {
  if (sb && !serverOff) return sbUpsert("app_settings", { id: 1, data: s });
  const d = lread(); d.settings = s; lwrite(d);
}

// ---------- 파일: 인증 서류(mentor-docs) · 조언 첨부(advice-files) — 둘 다 비공개 저장소 ----------
const MAX = 10 * 1024 * 1024;
export const OK_TYPES = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
async function toDataUrl(f: Blob): Promise<string> { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); }); }
async function shrinkImage(file: File, max: number): Promise<Blob> {
  if (!/^image\//.test(file.type)) return file;
  return new Promise((res) => {
    const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob((b) => res(b || file), "image/jpeg", 0.82); };
    im.onerror = () => res(file); im.src = url;
  });
}
async function put(bucket: "mentor-docs" | "advice-files", folder: string, file: File): Promise<{ path: string; url?: string; type: string }> {
  if (!OK_TYPES.test(file.type)) throw new Error("JPG·PNG·WEBP 사진이나 PDF만 올릴 수 있어요.");
  if (file.size > MAX) throw new Error("파일은 10MB까지 올릴 수 있어요.");
  if (sb && !serverOff) {
    const blob = await shrinkImage(file, 2000); const ext = file.type === "application/pdf" ? "pdf" : "jpg";
    const path = `${folder}/${Date.now()}-${rid()}.${ext}`;
    const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: ext === "pdf" ? "application/pdf" : "image/jpeg", upsert: false });
    if (error) throw new Error("파일을 올리지 못했어요: " + error.message);
    return { path, type: file.type };
  }
  // 데모: 사진은 줄여서, PDF는 2MB까지만 이 기기에 보관
  if (file.type === "application/pdf" && file.size > 2 * 1024 * 1024) throw new Error("데모 모드에서는 PDF를 2MB까지만 올릴 수 있어요. 사진으로 찍어 올려도 돼요.");
  return { path: "", url: await toDataUrl(await shrinkImage(file, 1100)), type: file.type };
}
export async function uploadDoc(u: AuthUser, kind: string, file: File): Promise<MentorDoc> {
  const x = await put("mentor-docs", u.id, file); return { id: rid(), kind, name: file.name, type: x.type, path: x.path, url: x.url, at: new Date().toISOString() };
}
export async function uploadAtt(u: AuthUser, reqId: string, file: File, by: Att["by"]): Promise<Att> {
  const x = await put("advice-files", `${u.id}/${reqId}`, file); return { id: rid(), name: file.name, type: x.type, path: x.path, url: x.url, by, at: new Date().toISOString() };
}
// 열람용 주소 — 서버 파일은 1시간짜리 서명 주소로만 열림(저작권·도용 방지)
export async function fileUrl(bucket: "mentor-docs" | "advice-files", f: { path: string; url?: string }): Promise<string> {
  if (f.url) return f.url;
  if (!sb || !f.path) return "";
  const { data } = await sb.storage.from(bucket).createSignedUrl(f.path, 3600);
  return data?.signedUrl || "";
}
// 승인·반려 후 인증 원본 삭제 (의뢰서 9: 확인 후 원본 삭제) — 어떤 서류를 언제 누가 확인했는지만 남김
export async function purgeDocs(m: Mentor): Promise<void> {
  const paths = m.docs.map((d) => d.path).filter(Boolean);
  if (sb && paths.length) { const { error } = await sb.storage.from("mentor-docs").remove(paths); if (error) throw new Error("인증 서류 원본을 지우지 못했어요: " + error.message); }
}
