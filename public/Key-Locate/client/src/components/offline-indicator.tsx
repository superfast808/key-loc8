import { WifiOff } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export function OfflineIndicator() {
  const { isOnline } = useOfflineSync();

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white text-sm px-4 py-2 flex items-center gap-2">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="font-medium">You are offline – changes cannot be saved until you reconnect.</span>
    </div>
  );
}

export function SyncStatusBadge() {
  const { isOnline } = useOfflineSync();

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
        <WifiOff className="h-3.5 w-3.5" />
        <span>Offline</span>
      </div>
    );
  }

  return null;
}
