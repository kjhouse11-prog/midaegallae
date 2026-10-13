import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

// 안드로이드 '앱 설치' 이벤트를 화면이 뜨기 전에 붙잡아 둠 (설치 버튼에서 사용)
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); (window as any).__bip = e; window.dispatchEvent(new Event("bip-ready")); });

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// 폰 홈 화면에 설치(PWA)할 수 있도록 서비스워커 등록 — 배포본에서만
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
