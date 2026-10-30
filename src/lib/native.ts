// 모바일 앱(안드로이드·아이폰, Capacitor) 연결 — 웹(PWA)에서는 아무 일도 하지 않음
// · 상태 표시줄 색(밝은/어두운 화면), 시작 화면 닫기
// · 바깥 링크(광고·지도·공개 자료)는 앱 안이 아니라 휴대폰 브라우저로 열기
// · 안드로이드 뒤로 가기 버튼: 상세 → 목록 → 홈 → 앱 종료
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PAYMENT_MODE, type PaymentMode } from "../config";

export const IS_NATIVE = Capacitor.isNativePlatform();
export const PLATFORM = Capacitor.getPlatform() as "android" | "ios" | "web";
// 앱 안 주소는 https://localhost 라서 이메일 인증·비밀번호 재설정 링크는 웹 주소로 보냄
export const WEB_URL = "https://kjhouse11-prog.github.io/midaegallae/";
export const authRedirect = () => (IS_NATIVE ? WEB_URL : location.href.split("#")[0]);

export async function openExternal(url: string) {
  if (!IS_NATIVE || !/^https?:/i.test(url)) { window.open(url, "_blank", "noopener"); return; }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

let backHandler: (() => boolean) | null = null;
// 화면 안쪽(학원 상세·멘토 요청 등)에서 여는 하위 화면 — 열려 있는 동안 뒤로 가기로 닫힘(나중에 연 것부터)
const backStack: { fn: () => void }[] = [];
export function useNativeBack(active: boolean, fn: () => void) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!active || !IS_NATIVE) return;
    const e = { fn: () => ref.current() }; backStack.push(e);
    return () => { const i = backStack.indexOf(e); if (i >= 0) backStack.splice(i, 1); };
  }, [active]);
}
// 화면에서 처리할 뒤로 가기 — 처리했으면 true, 아니면 앱 종료
export const setBackHandler = (h: (() => boolean) | null) => { backHandler = h; };

export async function initNative() {
  if (!IS_NATIVE) return;
  document.documentElement.classList.add("native", `native-${PLATFORM}`);
  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([import("@capacitor/status-bar"), import("@capacitor/splash-screen"), import("@capacitor/app")]);
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const paint = () => {
    StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }).catch(() => {});
    if (PLATFORM === "android") StatusBar.setBackgroundColor({ color: dark.matches ? "#101318" : "#F5F6F8" }).catch(() => {});
  };
  paint(); dark.addEventListener("change", paint);
  SplashScreen.hide().catch(() => {});

  // target="_blank" 링크와 바깥 주소 링크 → 휴대폰 브라우저. tel:·mailto:는 그대로(전화·메일 앱)
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented) return;
    const href = a.href;
    if (/^https?:/i.test(href) && (a.target === "_blank" || new URL(href).host !== location.host)) { e.preventDefault(); openExternal(href); }
  }, true);

  App.addListener("backButton", () => {
    const sheet = document.querySelector<HTMLElement>("[role=dialog] .linkbtn, [role=dialog] [aria-label=닫기]");
    if (sheet) { sheet.click(); return; }
    const top = backStack[backStack.length - 1]; if (top) { top.fn(); return; }
    if (backHandler && backHandler()) return;
    App.exitApp();
  });
}

// 유료 서비스 결제 방식 (config.ts 설명 참고)
export const paymentMode: PaymentMode = PAYMENT_MODE || (IS_NATIVE ? "off" : "test");
