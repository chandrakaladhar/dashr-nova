"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server page every `seconds` while provisioning is running. */
export function AutoRefresh({ seconds }: { seconds: number | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!seconds) return;
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
