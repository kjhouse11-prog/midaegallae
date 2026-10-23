// 데이터 저장 계층: Supabase가 설정되어 있으면 서버에, 아니면 이 기기(데모 모드)에 저장
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config";
import { SOLID_VIEWS } from "./data";

export interface Profile {
  name: string; grade: "고1" | "고2" | "고3" | "N수"; gpa: number; mock: number; major: string;
  regions: string[]; academyStart: string; /* YYYY-MM */ guardianConsent: boolean;
  mockKnown: boolean; school: string; schoolType: string;
  track: string; field: string; // 계열·분야 (5계열 21분야)
}
export interface Award { id: string; title: string; level?: string; awardedOn?: string; verified?: boolean }
export interface Analysis { scores: Record<string, number | null>; strengths: string[]; improvements: string[]; comment: string; nextTask?: string; model?: string }
export interface ArtView { key: string; label: string; url: string; path: string }
// views: 조형·공예 계열 입체 작품의 앞·뒤·좌·우 4면 사진 (url·path는 앞면)
export interface Artwork { id: string; url: string; path: string; genre: string; title?: string; madeOn: string; analysis?: Analysis | null; views?: ArtView[] }

export const DEFAULT_PROFILE: Profile = { name: "", grade: "고2", gpa: 3, mock: 60, major: "시각디자인", regions: ["서울", "경기"], academyStart: "", guardianConsent: false, mockKnown: false, school: "", schoolType: "일반고", track: "디자인 계열", field: "기초디자인" };

export const isDemo = !(SUPABASE_URL && SUPABASE_ANON_KEY);
export const sb: SupabaseClient | null = isDemo ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const gpaSystemOf = (g: Profile["grade"]) => (g === "고3" || g === "N수" ? "9등급" : "5등급");

// ---------- 이 기기 저장 (사용자별) — 플래너·체크리스트·첨삭 신청처럼 서버 테이블이 아직 없는 기능 ----------
export const ukey = (u: AuthUser, name: string) => `midae-${name}:${u.id}`;
export function uget<T>(u: AuthUser, name: string, fallback: T): T { try { const v = localStorage.getItem(ukey(u, name)); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } }
export function uset<T>(u: AuthUser, name: string, v: T) { try { localStorage.setItem(ukey(u, name), JSON.stringify(v)); } catch { /* 저장 공간 부족 등 */ } }

// ---------- 데모(로컬) 저장 ----------
const LK = "midae-navi-demo-v1";
type Local = { user?: { id: string; email: string }; profile?: Profile; awards: Award[]; works: Artwork[]; ids?: Record<string, string> };
const lread = (): Local => { try { return JSON.parse(localStorage.getItem(LK) || "") as Local; } catch { return { awards: [], works: [] }; } };
const lwrite = (d: Local) => { try { localStorage.setItem(LK, JSON.stringify(d)); } catch { /* 저장 공간 부족 등 */ } };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- 인증 ----------
export type AuthUser = { id: string; email: string };
const toUser = (u: User | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email || "" } : null);

export async function currentUser(): Promise<AuthUser | null> {
  if (sb) { const { data } = await sb.auth.getSession(); return toUser(data.session?.user); }
  return lread().user || null;
}
export function onAuthChange(cb: (u: AuthUser | null) => void): () => void {
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toUser(s?.user)));
  return () => data.subscription.unsubscribe();
}
export async function signUp(email: string, password: string, consent?: Consent): Promise<{ needsConfirm: boolean }> {
  if (sb) {
    // 메일 인증 전에는 세션이 없어 표에 못 씀 → 가입 정보(user_metadata)에 담아 두고 첫 로그인 때 표로 옮김
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("#")[0], data: consent ? { marketing_consent: consent } : undefined } });
    if (error) throw new Error(koError(error.message));
    return { needsConfirm: !data.session };
  }
  const d = lread(); d.user = { id: demoId(d, email), email }; lwrite(d); return { needsConfirm: false };
}
export async function signIn(email: string, password: string): Promise<void> {
  if (sb) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw new Error(koError(error.message)); return; }
  const d = lread(); d.user = d.user && d.user.email === email ? d.user : { id: demoId(d, email), email }; lwrite(d);
}
// 데모: 같은 이메일은 늘 같은 아이디 — 한 기기에서 계정을 바꿔 가며 이용자·선배·운영자 역할을 시험할 수 있게
function demoId(d: Local, email: string): string {
  d.ids = d.ids || {}; if (d.user) d.ids[d.user.email] = d.user.id;
  return (d.ids[email] = d.ids[email] || "demo-" + uid());
}
export async function resetPassword(email: string): Promise<void> {
  if (!sb) throw new Error("데모 모드에서는 비밀번호 재설정을 쓸 수 없어요.");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
  if (error) throw new Error(koError(error.message));
}
export async function signOut(): Promise<void> {
  if (sb) { await sb.auth.signOut(); return; }
  const d = lread(); delete d.user; lwrite(d);
}
function koError(m: string): string {
  if (/Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (/Email not confirmed/i.test(m)) return "이메일 인증이 아직 안 됐어요. 받은 편지함의 인증 메일을 눌러 주세요.";
  if (/already registered|already exists/i.test(m)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (/Password should be at least/i.test(m)) return "비밀번호는 6자 이상이어야 해요.";
  if (/rate limit/i.test(m)) return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
  return m;
}

// ---------- 마케팅 활용 동의 (주식회사 엠굿 · 월간 미대입시) ----------
// 개인정보보호법 제22조: 필수 동의와 분리한 선택 동의, 거부해도 가입·이용 가능
// 정보통신망법 제50조: 광고성 정보는 채널별 수신 동의, 시행령 제62조: 2년마다 수신 동의 여부 확인
export const CONSENT_VER = "2026-10";
export const CONSENT_CHANNELS = ["이메일", "앱 알림", "문자"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];
export type Consent = { marketing: boolean; channels: ConsentChannel[]; at: string; ver: string; withdrawnAt?: string };
export const CONSENT_TEXT = {
  company: "주식회사 엠굿(월간 미대입시)",
  items: "이메일, 학년, 관심 계열·분야, 선호 지역, 목표 대학",
  purpose: "엠굿 사업(월간 미대입시·입시설명회·실기대회·교재·교보재·미대갈래 제휴 대학·학원) 소식, 이벤트·할인 혜택 안내와 관심 분야 맞춤 광고",
  period: "동의 철회 또는 회원 탈퇴 시까지",
};
export const reconfirmDue = (c: Consent | null) => !!c?.marketing && Date.now() - Date.parse(c.at) > 730 * 864e5;
const missingTable = (m: string) => /marketing_consents|relation|schema cache|does not exist/i.test(m);
export async function loadConsent(u: AuthUser): Promise<Consent | null> {
  if (sb) {
    const { data, error } = await sb.from("marketing_consents").select("data").eq("user_id", u.id).maybeSingle();
    if (data?.data) return data.data as Consent;
    const meta = (await sb.auth.getUser()).data.user?.user_metadata?.marketing_consent as Consent | undefined;
    if (meta) { if (!error) await saveConsent(u, meta); return meta; }
    if (error && !missingTable(error.message)) throw new Error(error.message);
  }
  return uget<Consent | null>(u, "consent", null);
}
export async function saveConsent(u: AuthUser, c: Consent): Promise<void> {
  uset(u, "consent", c);
  if (!sb) return;
  const { error } = await sb.from("marketing_consents").upsert({ user_id: u.id, email: u.email, marketing: c.marketing, data: c, updated_at: new Date().toISOString() });
  if (error && !missingTable(error.message)) throw new Error("동의 내용을 저장하지 못했어요: " + error.message);
  await sb.auth.updateUser({ data: { marketing_consent: c } });
}
// 운영자: 동의 회원 목록 (데모는 이 기기의 모든 데모 계정)
export async function listConsents(): Promise<{ email: string; c: Consent }[]> {
  if (sb) {
    const { data, error } = await sb.from("marketing_consents").select("email,data").order("updated_at", { ascending: false });
    if (error) { if (missingTable(error.message)) return []; throw new Error(error.message); }
    return (data || []).map((r) => ({ email: r.email, c: r.data as Consent }));
  }
  const d = lread(), byId = Object.fromEntries(Object.entries(d.ids || {}).map(([e, id]) => [id, e]));
  if (d.user) byId[d.user.id] = d.user.email;
  return Object.entries(byId).flatMap(([id, email]) => { const c = uget<Consent | null>({ id, email }, "consent", null); return c ? [{ email, c }] : []; });
}

// ---------- 프로필 ----------
export async function loadProfile(u: AuthUser): Promise<Profile | null> {
  if (sb) {
    const { data, error } = await sb.from("profiles").select("*").eq("user_id", u.id).maybeSingle();
    if (error) throw new Error("프로필을 불러오지 못했어요: " + error.message);
    if (!data) return null;
    return { name: data.name || "", grade: data.grade || "고2", gpa: Number(data.gpa ?? 3), mock: Number(data.mock_pct ?? 60), major: data.major || "시각디자인",
      regions: data.regions || [], academyStart: data.academy_start ? String(data.academy_start).slice(0, 7) : "", guardianConsent: !!data.guardian_consent,
      mockKnown: data.mock_pct != null, school: data.school || "", schoolType: data.school_type || "일반고",
      track: data.track || extra(u).track || DEFAULT_PROFILE.track, field: data.field || extra(u).field || DEFAULT_PROFILE.field };
  }
  const lp = lread().profile; return lp ? { ...DEFAULT_PROFILE, ...lp } : null;
}
// 계열·분야는 v0.9 열(track·field). migrate_v0.9.sql 실행 전 DB면 열 없이 저장하고 이 기기에 따로 보관
const extra = (u: AuthUser) => uget<{ track?: string; field?: string }>(u, "profile-extra", {});
export async function saveProfile(u: AuthUser, p: Profile): Promise<void> {
  if (sb) {
    uset(u, "profile-extra", { track: p.track, field: p.field });
    const row = { user_id: u.id, name: p.name, grade: p.grade, gpa: p.gpa, gpa_system: gpaSystemOf(p.grade), mock_pct: p.mockKnown ? p.mock : null, school: p.school, school_type: p.schoolType,
      major: p.major, regions: p.regions, academy_start: p.academyStart ? p.academyStart + "-01" : null, guardian_consent: p.guardianConsent, updated_at: new Date().toISOString() };
    let { error } = await sb.from("profiles").upsert({ ...row, track: p.track, field: p.field });
    if (error && /track|field|column/i.test(error.message)) ({ error } = await sb.from("profiles").upsert(row));
    if (error) throw new Error("프로필을 저장하지 못했어요: " + error.message);
    return;
  }
  const d = lread(); d.profile = p; lwrite(d);
}

// ---------- 수상 ----------
export async function listAwards(u: AuthUser): Promise<Award[]> {
  if (sb) {
    const { data, error } = await sb.from("awards").select("*").eq("user_id", u.id).order("id");
    if (error) throw new Error(error.message);
    return (data || []).map((a) => ({ id: String(a.id), title: a.title, level: a.level, awardedOn: a.awarded_on, verified: a.verified }));
  }
  return lread().awards;
}
export async function addAward(u: AuthUser, title: string, level?: string): Promise<void> {
  if (sb) { const { error } = await sb.from("awards").insert({ user_id: u.id, title, level }); if (error) throw new Error(error.message); return; }
  const d = lread(); d.awards.push({ id: uid(), title, level }); lwrite(d);
}
export async function deleteAward(id: string): Promise<void> {
  if (sb) { const { error } = await sb.from("awards").delete().eq("id", Number(id)); if (error) throw new Error(error.message); return; }
  const d = lread(); d.awards = d.awards.filter((a) => a.id !== id); lwrite(d);
}

// ---------- 작품 ----------
export async function listArtworks(u: AuthUser): Promise<Artwork[]> {
  if (sb) {
    const { data, error } = await sb.from("artworks").select("*, analyses(*)").eq("user_id", u.id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data || [];
    if (!rows.length) return [];
    // 4면 작품은 앞면 경로(…-front.jpg)만 DB에 저장하고 나머지 면은 같은 이름 규칙으로 찾음 (DB 구조 변경 없음)
    const paths = rows.flatMap((r) => viewPaths(r.image_path) || [r.image_path]);
    const { data: signed } = await sb.storage.from("artworks").createSignedUrls(paths, 60 * 60);
    const urlOf = new Map(paths.map((p, i) => [p, signed?.[i]?.signedUrl || ""]));
    return rows.map((r) => {
      const a = (r.analyses || []).sort((x: { id: number }, y: { id: number }) => y.id - x.id)[0];
      const vp = viewPaths(r.image_path);
      return { id: r.id, path: r.image_path, url: urlOf.get(r.image_path) || "", views: vp ? vp.map((p, k) => ({ key: SOLID_VIEWS[k][0], label: SOLID_VIEWS[k][1], path: p, url: urlOf.get(p) || "" })) : undefined, genre: r.genre || "", title: r.title || "", madeOn: r.made_on || String(r.created_at).slice(0, 10),
        analysis: a ? { scores: a.scores, strengths: a.strengths || [], improvements: a.improvements || [], comment: a.comment || "", nextTask: a.next_task || "", model: a.model } : null };
    });
  }
  return lread().works;
}
export async function uploadArtwork(u: AuthUser, file: File, genre: string): Promise<void> {
  const blob = await shrink(file, 1600);
  if (sb) {
    const path = `${u.id}/${Date.now()}-${uid()}.jpg`;
    const up = await sb.storage.from("artworks").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw new Error("사진을 올리지 못했어요: " + up.error.message);
    const { error } = await sb.from("artworks").insert({ user_id: u.id, image_path: path, genre, made_on: new Date().toISOString().slice(0, 10) });
    if (error) { await sb.storage.from("artworks").remove([path]); throw new Error("작품 정보를 저장하지 못했어요: " + error.message); }
    return;
  }
  const small = await shrink(file, 900);
  const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(small); });
  const d = lread(); d.works.unshift({ id: uid(), url, path: "", genre, madeOn: new Date().toISOString().slice(0, 10), analysis: null }); lwrite(d);
}
const viewPaths = (front: string) => front.endsWith("-front.jpg") ? SOLID_VIEWS.map(([k]) => front.replace(/-front\.jpg$/, `-${k}.jpg`)) : null;
// 입체 작품 4면 업로드 — files는 앞·뒤·좌·우 순서
export async function uploadSolidArtwork(u: AuthUser, files: File[], genre: string): Promise<void> {
  if (files.length !== SOLID_VIEWS.length) throw new Error("앞·뒤·좌·우 4면 사진이 모두 필요해요.");
  if (sb) {
    const base = `${u.id}/${Date.now()}-${uid()}`, done: string[] = [];
    try {
      for (let k = 0; k < files.length; k++) {
        const path = `${base}-${SOLID_VIEWS[k][0]}.jpg`;
        const up = await sb.storage.from("artworks").upload(path, await shrink(files[k], 1600), { contentType: "image/jpeg", upsert: false });
        if (up.error) throw new Error(`${SOLID_VIEWS[k][1]}면 사진을 올리지 못했어요: ` + up.error.message);
        done.push(path);
      }
      const { error } = await sb.from("artworks").insert({ user_id: u.id, image_path: done[0], genre, made_on: new Date().toISOString().slice(0, 10) });
      if (error) throw new Error("작품 정보를 저장하지 못했어요: " + error.message);
    } catch (x) { if (done.length) await sb.storage.from("artworks").remove(done); throw x; }
    return;
  }
  const urls: string[] = [];
  for (const f of files) { const small = await shrink(f, 700); urls.push(await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(small); })); }
  const d = lread();
  d.works.unshift({ id: uid(), url: urls[0], path: "", genre, madeOn: new Date().toISOString().slice(0, 10), analysis: null, views: urls.map((url, k) => ({ key: SOLID_VIEWS[k][0], label: SOLID_VIEWS[k][1], url, path: "" })) });
  lwrite(d);
}
export async function deleteArtwork(w: Artwork): Promise<void> {
  if (sb) {
    const { error } = await sb.from("artworks").delete().eq("id", w.id);
    if (error) throw new Error(error.message);
    await sb.storage.from("artworks").remove(w.views?.length ? w.views.map((v) => v.path) : [w.path]);
    return;
  }
  const d = lread(); d.works = d.works.filter((x) => x.id !== w.id); lwrite(d);
}
export async function saveAnalysis(w: Artwork, a: Analysis): Promise<void> {
  if (sb) {
    const { error } = await sb.from("analyses").insert({ artwork_id: w.id, model: a.model || "", scores: a.scores, strengths: a.strengths, improvements: a.improvements, comment: a.comment, next_task: a.nextTask || "" });
    if (error) throw new Error(error.message);
    return;
  }
  const d = lread(); const x = d.works.find((v) => v.id === w.id); if (x) x.analysis = a; lwrite(d);
}

function shrink(file: File, max: number): Promise<Blob> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("이미지를 처리하지 못했어요."))), "image/jpeg", 0.85);
    };
    im.onerror = () => rej(new Error("이미지 파일을 읽지 못했어요.")); im.src = url;
  });
}
