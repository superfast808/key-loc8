import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";

type NFCResult =
  | { found: true; id: number; identifier: string; address: string; type: string; status: string; locationName: string | null }
  | { found: false };

interface BannerState {
  id: number;
  result: NFCResult;
}

export function GlobalNFCListener() {
  const { isAuthenticated } = useAuth();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { getTypeDisplayName, getStatusDisplayName } = useSettingsHelpers();

  const showBanner = (result: NFCResult) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setBanner({ id: Date.now(), result });
    dismissTimer.current = setTimeout(() => setBanner(null), 6000);
  };

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setBanner(null);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!("NDEFReader" in window)) return;

    let cancelled = false;

    const start = async () => {
      try {
        const reader = new (window as any).NDEFReader();
        readerRef.current = reader;
        const controller = new AbortController();
        abortRef.current = controller;

        await reader.scan({ signal: controller.signal });

        reader.addEventListener("reading", async (event: any) => {
          if (cancelled) return;

          // Extract serial number
          let serial: string;
          const sn = event.serialNumber;
          if (sn && typeof sn !== "string") {
            try {
              serial = Array.from(new Uint8Array(sn))
                .map((b: any) => b.toString(16).padStart(2, "0"))
                .join(":");
            } catch {
              serial = String(sn);
            }
          } else {
            serial = sn || `nfc_${Date.now()}`;
          }

          try {
            const res = await fetch(
              `/api/nfc/lookup?serial=${encodeURIComponent(serial)}`,
              { credentials: "include" }
            );
            if (res.status === 404) {
              showBanner({ found: false });
            } else if (res.ok) {
              const data = await res.json();
              showBanner(data as NFCResult);
            }
          } catch {
            // Network error — silently ignore
          }
        });

        reader.addEventListener("readingerror", () => {
          // Tag read error — ignore silently
        });
      } catch {
        // Permission denied or not available — ignore
      }
    };

    start();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [isAuthenticated]);

  if (!banner) return null;

  const found = banner.result.found;

  return (
    <div
      key={banner.id}
      className={`fixed top-14 left-0 right-0 z-50 mx-auto max-w-lg px-4 animate-in slide-in-from-top-2 duration-300`}
      style={{ top: "60px" }}
    >
      <div
        className={`flex items-start gap-3 rounded-xl shadow-lg border px-4 py-3 ${
          found
            ? "bg-green-50 border-green-200 text-green-900"
            : "bg-amber-50 border-amber-200 text-amber-900"
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {found ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {found && banner.result.found ? (
            <>
              <p className="font-semibold text-sm leading-tight">
                {banner.result.identifier}
                {banner.result.address ? ` — ${banner.result.address}` : ""}
              </p>
              <p className="text-xs mt-0.5 text-green-700">
                {[
                  getTypeDisplayName(banner.result.type),
                  getStatusDisplayName(banner.result.status),
                  banner.result.locationName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </>
          ) : (
            <p className="font-semibold text-sm">
              NFC tag scanned — not registered to any keys
            </p>
          )}
        </div>

        <button
          onClick={dismiss}
          className={`shrink-0 rounded-md p-0.5 hover:opacity-70 transition-opacity ${
            found ? "text-green-600" : "text-amber-600"
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
