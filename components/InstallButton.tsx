"use client";
import { useEffect, useRef, useState } from "react";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome only fires beforeinstallprompt once, early, so it is parked outside the
// component: a remount must not lose the only chance to install in one tap.
let pendingPrompt: PromptEvent | null = null;
const listeners = new Set<() => void>();
function capturePrompt(e: Event) {
  e.preventDefault();
  pendingPrompt = e as PromptEvent;
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", capturePrompt);
}

type Platform = "ios" | "android" | "other";
type Browser = "safari" | "chrome" | "inapp" | "other";

function detect(ua: string, touchPoints: number, macIntel: boolean): [Platform, Browser] {
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (macIntel && touchPoints > 1);
  const android = /Android/.test(ua);
  const inapp =
    /FBAV|Instagram|WhatsApp|LinkedIn|mini\(Weixin|Musical_ly|Bytedance/i.test(ua);
  const chrome = /Chrome|CriOS|Edg|SamsungBrowser|FxiOS/.test(ua) && !inapp;
  const browser: Browser = inapp ? "inapp" : chrome ? "chrome" : "safari";
  return [ios ? "ios" : android ? "android" : "other", browser];
}

function Steps({ platform, browser }: { platform: Platform; browser: Browser }) {
  if (browser === "inapp") {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Tap <b>⋯</b> or <b>…</b> at the top of this page.
        </li>
        <li>
          Choose <b>Open in Safari</b> (iPhone) or <b>Open in Chrome / Browser</b> (Android).
        </li>
        <li>Then tap the green Install button again. It works there, not inside this app.</li>
      </ol>
    );
  }
  if (platform === "ios") {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Tap the <b>Share</b> button — the square with the arrow pointing up,{" "}
          <b>at the bottom of Safari</b>.
        </li>
        <li>
          Scroll down and tap <b>Add to Home Screen</b>.
        </li>
        <li>
          Tap <b>Add</b>. FixZed now has its own icon and opens full screen like an app.
        </li>
      </ol>
    );
  }
  if (platform === "android" && browser === "chrome") {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Tap <b>⋮</b> at the top right of Chrome.
        </li>
        <li>
          Tap <b>Add app to home screen</b> or <b>Install app</b>.
        </li>
        <li>Tap <b>Install</b> to finish.</li>
      </ol>
    );
  }
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>Open fixzed.netlify.app on your Android or iPhone browser.</li>
      <li>
        On iPhone use <b>Safari</b>; on Android use <b>Chrome</b>. Other browsers cannot install
        websites.
      </li>
      <li>You will get the Install button there too.</li>
    </ol>
  );
}

export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const [, forceRender] = useState(0);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [browser, setBrowser] = useState<Browser>("other");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onChange = () => forceRender((n) => n + 1);
    listeners.add(onChange);
    const ua = navigator.userAgent;
    const [p, b] = detect(ua, navigator.maxTouchPoints ?? 0, navigator.platform === "MacIntel");
    setPlatform(p);
    setBrowser(b);
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true
    );
    window.addEventListener("appinstalled", onChange);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("appinstalled", onChange);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function start() {
    if (pendingPrompt) {
      const evt = pendingPrompt;
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") {
        setDone(true);
        pendingPrompt = null;
        return;
      }
    }
    setOpen(true);
  }

  if (installed || done) {
    return (
      <p className="rounded-xl bg-zgreen/10 p-3 text-sm font-semibold text-zdeep">
        ✅ FixZed is on your phone. Open it from its own icon.
      </p>
    );
  }

  const oneTap = !!pendingPrompt;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          className={`rounded-xl bg-zgreen font-bold text-white shadow-lg hover:bg-zdeep ${
            compact ? "px-4 py-2 text-sm" : "px-6 py-3 text-base"
          }`}
        >
          ⬇️ Install the FixZed app
        </button>
        <span className="text-xs text-gray-600">
          {oneTap
            ? "Free · no Play Store or App Store account · opens full screen"
            : "Free · about 20 seconds · no Play Store or App Store account"}
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="How to install FixZed"
            className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold text-zdeep">
                  {browser === "inapp"
                    ? "Open FixZed in your browser first"
                    : platform === "ios"
                      ? "Add FixZed to your Home Screen"
                      : "Install FixZed as an app"}
                </p>
                <p className="text-xs text-gray-500">
                  {platform === "ios"
                    ? "iPhone or iPad · Safari"
                    : platform === "android" && browser === "chrome"
                      ? "Android · Chrome"
                      : "Any phone · Safari or Chrome"}
                  {" · takes about 20 seconds"}
                </p>
              </div>
              <button
                ref={closeRef}
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full px-3 py-1 text-gray-500 hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            <Steps platform={platform} browser={browser} />

            {platform === "ios" && browser !== "inapp" && (
              <p className="rounded-xl bg-zcream p-3 text-xs text-gray-700">
                Apple does not allow a website to install itself, so this last step is a tap in
                Safari. Nothing is bought and no account is needed.
              </p>
            )}
            <p className="text-xs text-gray-500">
              Already see a banner at the top of Safari? Tap <b>Install FixZed</b> there instead.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
