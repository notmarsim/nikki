"use client";

import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore SW registration failure in unsupported environments
      });
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <>
      {offline && (
        <div
          role="status"
          className="pt-safe sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-3 py-1 text-xs font-medium text-white"
        >
          <WifiOff className="h-3.5 w-3.5" />
          Offline mode — changes require connection to sync with Supabase
        </div>
      )}
      {children}
    </>
  );
}
