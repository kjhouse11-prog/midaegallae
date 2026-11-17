import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";
import { IS_NATIVE, initNative } from "./lib/native";

// 안드로이드 '앱 설치' 이벤트를 화면이 뜨기 전에 붙잡아 둠 (설치 버튼에서 사용)
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); (window as any).__bip = e; window.dispatchEvent(new Event("bip-ready")); });

initNative();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// 폰 홈 화면에 설치(PWA)할 수 있도록 서비스워커 등록 — 웹 배포본에서만 (스토어 앱은 화면 파일이 앱 안에 들어 있어 불필요)
if (import.meta.env.PROD && !IS_NATIVE && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {}); });
}
