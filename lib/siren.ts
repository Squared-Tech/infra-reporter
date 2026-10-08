let ctx: any = null;

export function audioCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  audioCtx();
}

export function playSiren() {
  const c = audioCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(c.destination);
    const t = c.currentTime;
    for (let i = 0; i < 6; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? 988 : 660, t + i * 0.4);
    }
    osc.start(t);
    osc.stop(t + 2.4);
  } catch {}
}
