"use client";
import { useEffect, useState } from "react";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fixzed-install-dismissed";

export default function InstallPrompt() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = navigator.userAgent;
    setIos(
      /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    const onInstalled = () => {
      setEvt(null);
      setGone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (gone || (!evt && !ios)) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setGone(true);
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "accepted") setGone(true);
    setEvt(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-zgreen bg-zcream p-4">
      <p className="text-3xl">📲</p>
      <div className="flex-1 min-w-[180px]">
        <p className="font-bold text-zdeep">Install FixZed on your phone</p>
        <p className="text-xs text-gray-600">
          {evt
            ? "Get an app icon, full screen and a faster start for reporting."
            : "In Safari: tap Share, then Add to Home Screen."}
        </p>
      </div>
      {evt && (
        <button
          onClick={install}
          className="rounded-xl bg-zgreen px-4 py-2 text-sm font-bold text-white hover:brightness-110"
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss install hint"
        className="rounded-full px-2 py-1 text-gray-500 hover:bg-black/5"
      >
        ✕
      </button>
    </div>
  );
}
