export type NikkiPlatform =
  | "capacitor-android"
  | "ios-pwa-standalone"
  | "mobile-web"
  | "desktop-web";

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
}

export function detectNikkiPlatform(): NikkiPlatform {
  if (typeof window === "undefined") return "desktop-web";

  const cap = (window as CapacitorWindow).Capacitor;
  if (cap?.isNativePlatform?.() || cap?.getPlatform?.() === "android") {
    return "capacitor-android";
  }

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const isIosTouch =
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  if (isStandalone && isIosTouch) {
    return "ios-pwa-standalone";
  }

  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  if (isCoarsePointer || window.innerWidth < 768) {
    return "mobile-web";
  }

  return "desktop-web";
}

export function isIosSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}
