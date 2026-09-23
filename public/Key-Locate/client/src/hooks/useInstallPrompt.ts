import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isInstalled =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;

  // Always show option unless already running as installed standalone app
  const canInstall = !isInstalled;

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall(): Promise<"accepted" | "dismissed" | "ios" | "instructions" | "unavailable"> {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return outcome;
    }
    if (isIOS) return "ios";
    // Desktop / other — guide user to use the browser's address bar install icon
    return "instructions";
  }

  return { canInstall, isIOS, isInstalled, triggerInstall };
}
