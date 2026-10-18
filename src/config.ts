// 환경 설정 — GitHub Actions Variables 또는 .env 에서 주입. 비어 있으면 데모 모드(이 기기 저장).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const APP_VERSION = "0.6.2";
