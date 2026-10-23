// 환경 설정 — GitHub Actions Variables 또는 .env 에서 주입. 비어 있으면 데모 모드(이 기기 저장).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
// 운영자(관리자) 이메일 — 쉼표로 여러 명. 화면 표시용이며, 실제 권한은 Supabase admins 테이블로 확인
export const ADMIN_EMAILS: string[] = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
export const APP_VERSION = "0.11.1";
