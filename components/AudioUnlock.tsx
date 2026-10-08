"use client";
import { useEffect } from "react";
import { unlockAudio } from "@/lib/siren";

// Unlocks WebAudio on the first click/keypress anywhere in the app (e.g. the
// Login button), so later alarms can play sound with no extra tapping.
export default function AudioUnlock() {
  useEffect(() => {
    const u = () => unlockAudio();
    window.addEventListener("pointerdown", u, true);
    window.addEventListener("keydown", u, true);
    return () => {
      window.removeEventListener("pointerdown", u, true);
      window.removeEventListener("keydown", u, true);
    };
  }, []);
  return null;
}
