// 환경 설정 — GitHub Actions Variables 또는 .env 에서 주입. 비어 있으면 데모 모드(이 기기 저장).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
// 운영자(관리자) 이메일 — 쉼표로 여러 명. 화면 표시용이며, 실제 권한은 Supabase admins 테이블로 확인
export const ADMIN_EMAILS: string[] = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
export const APP_VERSION = "0.13.0";
// 유료 서비스(1:1 선배 조언·실기 첨삭) 결제 방식 — 대표 최종 결정 전까지 실결제 연동 보류
//   test: 테스트 결제(돈이 오가지 않음, 웹 베타 기본) · off: 결제 단계 대신 '출시 알림 신청'(스토어 앱 기본) · live: PG 연동 후 사용
// 스토어 심사에서 가짜 결제 화면은 반려 사유가 될 수 있어, 앱(안드로이드·아이폰)은 결정 전까지 off
export type PaymentMode = "test" | "off" | "live";
export const PAYMENT_MODE = (import.meta.env.VITE_PAYMENT_MODE || "") as PaymentMode | "";
// 고객센터 이메일 (학원·대학 정보 수정 요청, 탈퇴 문의) — 정해지면 GitHub Variables 에 VITE_SUPPORT_EMAIL 등록
export const SUPPORT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL || "";
