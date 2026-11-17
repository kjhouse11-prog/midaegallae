// 모바일 앱(안드로이드·아이폰) 설정 — 웹 화면(dist)을 그대로 앱에 담아 스토어에 올립니다.
// 앱 ID는 스토어 등록 후 바꿀 수 없으니 확정 전 확인 필요 (엠굿 도메인 mgood.co.kr 기준).
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "kr.co.mgood.midaegallae",
  appName: "미대갈래",
  webDir: "dist",
  backgroundColor: "#F5F6F8",
  android: { allowMixedContent: false },
  ios: { contentInset: "never", scheme: "미대갈래" },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: "#2747D8", showSpinner: false, androidScaleType: "CENTER_CROP" },
    StatusBar: { overlaysWebView: false, style: "LIGHT", backgroundColor: "#F5F6F8" },
    Keyboard: { resize: "body" },
  },
};

export default config;
