const CONFETTI_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

export function spawnConfetti(anchor: HTMLElement): void {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const rect = anchor.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    const angle = (i / 12) * 2 * Math.PI;
    const dist = 40 + Math.random() * 30;
    el.style.cssText = `
      left:${cx}px; top:${cy}px; position:fixed; z-index:9999;
      background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
      --tx:${Math.cos(angle) * dist}px; --ty:${Math.sin(angle) * dist}px;
      width:6px; height:6px; border-radius:50%; pointer-events:none;
      animation: confettiFly 0.65s ease-out forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}

export function playChime(): void {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  try {
    const ctx = new AudioContext();
    const notes = [261.63, 329.63, 392.00];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* AudioContext may not be available */ }
}
