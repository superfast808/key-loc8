import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("keylocate_install_dismissed") === "true"
  );

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    const standalone = (window.navigator as any).standalone === true;
    if (ios && !standalone && !dismissed) {
      setIsIOS(true);
      setShowBanner(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const isInstalled =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  if (isInstalled || !showBanner || dismissed) return null;

  function dismiss() {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem("keylocate_install_dismissed", "true");
  }

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }

  if (showIOSGuide) {
    return (
      <div className="bg-blue-700 text-white text-sm px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Install keylocate on your iPhone</p>
              <p className="text-blue-100 text-xs mt-1">
                Tap the <strong>Share</strong> button in Safari, then select <strong>"Add to Home Screen"</strong> to install the app.
              </p>
            </div>
          </div>
          <button onClick={dismiss} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-700 text-white text-sm px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-semibold">Install keylocate</span>
          <span className="opacity-80 hidden sm:inline"> — works offline, access from your home screen</span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs bg-white text-blue-700 hover:bg-blue-50"
          onClick={handleInstall}
        >
          {isIOS ? "How to install" : "Install"}
        </Button>
        <button onClick={dismiss} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
