"use client";
import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    // Dev serves uncached bundles; registering here would only cause stale reloads.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
