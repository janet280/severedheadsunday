import { useCallback, useEffect, useRef, useState } from "react";
import { getOrCreateAudioGraph } from "../audioGraph";

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlayingContext: boolean;
  /** Remount media binding when the active track / audio node changes. */
  trackKey?: number;
  /** When set, switches the active visualization mode. */
  modeOverride?: VizMode | null;
};

export type VizMode = "rings" | "wave" | "spikes" | "fireflies" | "rush";

export const VIZ_MODES: { id: VizMode; label: string }[] = [
  { id: "rings", label: "RINGS" },
  { id: "wave", label: "WAVE" },
  { id: "spikes", label: "SPIKES" },
  { id: "fireflies", label: "FLIES" },
  { id: "rush", label: "RUSH" },
];

export function pickRandomVizMode(exclude?: VizMode): VizMode {
  const pool = exclude
    ? VIZ_MODES.filter((m) => m.id !== exclude)
    : VIZ_MODES;
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? VIZ_MODES[0];
  return pick.id;
}

type Firefly = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  hue: number;
  size: number;
  /** Base tempo: slow (~0.25) or fast (~1.1), picked at spawn. */
  pace: number;
  /** Phase for slow↔fast oscillation. */
  pacePhase: number;
  paceRate: number;
};

/** Hardcore-Henry-style first-person rush: obstacles flying at the camera. */
type RushObstacle = {
  /** Depth: 1 = near crash, larger = far ahead */
  z: number;
  /** -1 left … 1 right of center */
  lane: number;
  w: number;
  h: number;
  kind: "car" | "wall" | "sign";
  hue: number;
};

type RushState = {
  obstacles: RushObstacle[];
  shake: number;
  flash: number;
  distance: number;
};

function ensureRush(state: RushState, count: number) {
  while (state.obstacles.length < count) {
    const kindRoll = Math.random();
    state.obstacles.push({
      z: 2 + Math.random() * 14,
      lane: (Math.random() - 0.5) * 2.2,
      w: 0.35 + Math.random() * 0.7,
      h: 0.4 + Math.random() * 1.4,
      kind: kindRoll < 0.45 ? "car" : kindRoll < 0.75 ? "wall" : "sign",
      hue: kindRoll < 0.45 ? 0 + Math.random() * 20 : 200 + Math.random() * 40,
    });
  }
}

function recycleRushObstacle(o: RushObstacle) {
  o.z = 10 + Math.random() * 10;
  o.lane = (Math.random() - 0.5) * 2.4;
  o.w = 0.3 + Math.random() * 0.85;
  o.h = 0.35 + Math.random() * 1.6;
  const kindRoll = Math.random();
  o.kind = kindRoll < 0.45 ? "car" : kindRoll < 0.75 ? "wall" : "sign";
  o.hue = o.kind === "car" ? Math.random() * 25 : 190 + Math.random() * 50;
}

function drawRush(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  state: RushState,
) {
  if (w < 2 || h < 2) return;

  let energy = 0;
  const band = Math.min(48, data.length);
  for (let i = 0; i < band; i++) energy += data[i];
  energy = energy / band / 255;

  const speed = 0.55 + energy * 1.85;
  ensureRush(state, 28 + Math.floor(energy * 22));
  state.distance += speed * 0.35;
  state.shake *= 0.88;
  state.flash *= 0.82;

  const cx = w / 2;
  const horizon = h * 0.42;
  const shakeX = (Math.random() - 0.5) * state.shake * 18;
  const shakeY = (Math.random() - 0.5) * state.shake * 14;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Motion trail / smear
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(-20, -20, w + 40, h + 40);

  // Road wedge toward vanishing point
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.02, horizon);
  ctx.lineTo(cx + w * 0.02, horizon);
  ctx.lineTo(w * 1.1, h + 10);
  ctx.lineTo(-w * 0.1, h + 10);
  ctx.closePath();
  ctx.fillStyle = "#0a0a0a";
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 40, 40, ${0.15 + energy * 0.35})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center dashed line racing toward camera
  for (let i = 0; i < 18; i++) {
    const t = ((state.distance * 0.15 + i * 0.08) % 1.2) / 1.2;
    const z = 0.8 + t * 12;
    const y = horizon + ((h - horizon) * (1 - 1 / z)) * 1.05;
    const half = (w * 0.012) / z;
    const len = (h * 0.04) / z;
    ctx.fillStyle = `rgba(255, 220, 180, ${0.25 + energy * 0.4})`;
    ctx.fillRect(cx - half, y, half * 2, Math.max(2, len));
  }

  // Side rush streaks (traffic / alley blur)
  for (let i = 0; i < 40; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const t = (state.distance * 0.4 + i * 1.7) % 1;
    const z = 1.2 + t * 9;
    const x = cx + side * (w * 0.08 + (w * 0.55) / z);
    const y0 = horizon - h * 0.15 + (Math.random() - 0.5) * 20;
    const y1 = h + 20;
    ctx.strokeStyle = `hsla(${(i * 17) % 40}, 90%, 55%, ${0.08 + energy * 0.2})`;
    ctx.lineWidth = Math.max(1, 6 / z);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + side * (30 + energy * 40) / z, y1);
    ctx.stroke();
  }

  // Sort far → near for painter's algorithm
  state.obstacles.sort((a, b) => b.z - a.z);

  for (const o of state.obstacles) {
    o.z -= speed * (0.22 + energy * 0.2);

    if (o.z < 0.55) {
      // Near miss / almost crash
      if (Math.abs(o.lane) < 0.55) {
        state.shake = Math.min(1.4, state.shake + 0.55 + energy * 0.5);
        state.flash = Math.min(1, state.flash + 0.45);
      } else {
        state.shake = Math.min(1, state.shake + 0.15);
      }
      recycleRushObstacle(o);
      continue;
    }

    const scale = 1 / o.z;
    const px = cx + o.lane * w * 0.38 * scale;
    const py = horizon + (h - horizon) * (1 - scale) * 0.95;
    const bw = Math.max(4, o.w * w * 0.55 * scale);
    const bh = Math.max(6, o.h * h * 0.45 * scale);
    const alpha = Math.min(0.95, 0.25 + scale * 0.7);

    if (o.kind === "car") {
      ctx.fillStyle = `hsla(${o.hue}, 85%, ${35 + scale * 25}%, ${alpha})`;
      ctx.fillRect(px - bw / 2, py - bh * 0.35, bw, bh * 0.55);
      // Headlights screaming at you
      ctx.fillStyle = `hsla(50, 100%, 80%, ${alpha * 0.85})`;
      ctx.fillRect(px - bw * 0.35, py - bh * 0.1, bw * 0.18, bh * 0.12);
      ctx.fillRect(px + bw * 0.17, py - bh * 0.1, bw * 0.18, bh * 0.12);
    } else if (o.kind === "wall") {
      ctx.fillStyle = `hsla(0, 0%, ${12 + scale * 20}%, ${alpha})`;
      ctx.fillRect(px - bw / 2, py - bh, bw, bh);
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.2 + energy * 0.3})`;
      ctx.strokeRect(px - bw / 2, py - bh, bw, bh);
    } else {
      ctx.fillStyle = `hsla(${o.hue}, 70%, 45%, ${alpha})`;
      ctx.fillRect(px - bw * 0.15, py - bh, bw * 0.3, bh);
      ctx.fillRect(px - bw / 2, py - bh, bw, bh * 0.25);
    }

    // Speed lines off near objects
    if (o.z < 3) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * scale})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - o.lane * 40 * scale, py + 50 * scale);
      ctx.stroke();
    }
  }

  // Horizon glare
  const glare = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, w * 0.35);
  glare.addColorStop(0, `rgba(255, 60, 40, ${0.08 + energy * 0.2})`);
  glare.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();

  // Crash / near-miss flash overlay (unshaken)
  if (state.flash > 0.05) {
    ctx.fillStyle = `rgba(255, 30, 20, ${state.flash * 0.35})`;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(255, 255, 255, ${state.flash * 0.5})`;
    ctx.lineWidth = 4 + state.flash * 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }

  // Vignette
  const vig = ctx.createRadialGradient(cx, h * 0.55, h * 0.2, cx, h * 0.55, h * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function getFullscreenElement(): Element | null {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function requestFullscreen(el: HTMLElement) {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (el.requestFullscreen) {
    await el.requestFullscreen();
  } else if (anyEl.webkitRequestFullscreen) {
    await anyEl.webkitRequestFullscreen();
  }
}

async function exitFullscreen() {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  hue: number,
) {
  const centerX = w / 2;
  const centerY = h / 2;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0;
    const radius = (v * h) / 1.8 + i * 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `hsla(${(hue + i * 12) % 360}, 90%, 50%, 0.15)`;
    ctx.lineWidth = 15;
    ctx.stroke();

    if (v > 1.15) {
      ctx.fillStyle = `hsla(${(hue + 180) % 360}, 100%, 60%, 0.03)`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, v * 70, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  timeData: Uint8Array,
  w: number,
  h: number,
  hue: number,
) {
  const mid = h / 2;
  ctx.beginPath();
  ctx.strokeStyle = `hsla(${hue}, 90%, 55%, 0.85)`;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = `hsla(${hue}, 100%, 50%, 0.6)`;
  ctx.shadowBlur = 12;

  for (let i = 0; i < timeData.length; i++) {
    const x = (i / (timeData.length - 1)) * w;
    const v = (timeData[i] - 128) / 128;
    const y = mid + v * mid * 0.85;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.strokeStyle = `hsla(${(hue + 180) % 360}, 80%, 60%, 0.25)`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < timeData.length; i++) {
    const x = (i / (timeData.length - 1)) * w;
    const v = (timeData[i] - 128) / 128;
    const y = mid - v * mid * 0.55;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSpikes(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  hue: number,
) {
  const maxDim = Math.min(w, h);
  let energy = 0;
  const band = Math.min(40, data.length);
  for (let i = 0; i < band; i++) energy += data[i];
  energy = energy / band / 255;

  // Tempest camera sway
  const centerX = w / 2 + (Math.random() - 0.5) * energy * 18;
  const centerY = h / 2 + (Math.random() - 0.5) * energy * 14;
  const count = Math.min(96, data.length);
  const base = maxDim * (0.08 + energy * 0.04);

  // Inner crackle ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, base * (0.5 + Math.random() * 0.4), 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${0.15 + energy * 0.25})`;
  ctx.lineWidth = 1 + energy * 3;
  ctx.stroke();

  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * data.length);
    const v = data[idx] / 255;
    // Uneven storm angles + jitter
    const angle =
      (i / count) * Math.PI * 2 -
      Math.PI / 2 +
      (Math.random() - 0.5) * (0.12 + energy * 0.2);

    // Most spikes medium; random bolts go huge
    const storm = Math.random();
    const bolt = storm > 0.92 - energy * 0.12;
    const gust = storm > 0.75 - energy * 0.1;
    const lenMul = bolt
      ? 1.6 + Math.random() * 1.8
      : gust
        ? 1.05 + Math.random() * 0.85
        : 0.35 + Math.random() * 0.75;

    const len = base + v * maxDim * (0.28 + energy * 0.35) * lenMul;
    const inner = base * (0.25 + Math.random() * 0.35);
    const x1 = centerX + Math.cos(angle) * inner;
    const y1 = centerY + Math.sin(angle) * inner;
    const x2 = centerX + Math.cos(angle) * len;
    const y2 = centerY + Math.sin(angle) * len;

    // Forked lightning tip on big bolts
    if (bolt) {
      const fork = angle + (Math.random() - 0.5) * 0.45;
      const mid = len * (0.55 + Math.random() * 0.25);
      const mx = centerX + Math.cos(angle) * mid;
      const my = centerY + Math.sin(angle) * mid;
      const fx = centerX + Math.cos(fork) * len * (0.85 + Math.random() * 0.3);
      const fy = centerY + Math.sin(fork) * len * (0.85 + Math.random() * 0.3);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(fx, fy);
      ctx.strokeStyle = `hsla(${(hue + 40) % 360}, 100%, 75%, ${0.35 + v * 0.4})`;
      ctx.lineWidth = 1 + v * 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    // Slight jagged mid-point
    if (gust || bolt) {
      const jag = angle + (Math.random() - 0.5) * 0.2;
      const midLen = len * (0.4 + Math.random() * 0.3);
      ctx.lineTo(
        centerX + Math.cos(jag) * midLen,
        centerY + Math.sin(jag) * midLen,
      );
    }
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = bolt
      ? `hsla(${(hue + Math.random() * 40) % 360}, 100%, ${60 + v * 30}%, ${0.55 + v * 0.4})`
      : `hsla(${(hue + i * 5) % 360}, 90%, ${40 + v * 35}%, ${0.3 + v * 0.55})`;
    ctx.lineWidth = bolt ? 3 + v * 7 + energy * 4 : 1 + v * 3.5;
    ctx.stroke();
  }

  // Core storm eye
  const core = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    base * (1.2 + energy),
  );
  core.addColorStop(0, `hsla(${hue}, 100%, 70%, ${0.25 + energy * 0.35})`);
  core.addColorStop(0.5, `hsla(${(hue + 20) % 360}, 90%, 40%, 0.12)`);
  core.addColorStop(1, "hsla(0, 0%, 0%, 0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(centerX, centerY, base * (1.2 + energy), 0, Math.PI * 2);
  ctx.fill();
}

function ensureFireflies(
  flies: Firefly[],
  w: number,
  h: number,
  count: number,
) {
  if (flies.length > 0 && typeof flies[0].pace !== "number") {
    flies.length = 0;
  }
  while (flies.length < count) {
    const fast = Math.random() < 0.35;
    flies.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * (fast ? 0.5 : 0.2),
      vy: (Math.random() - 0.5) * (fast ? 0.5 : 0.2),
      phase: Math.random() * Math.PI * 2,
      hue: 110 + Math.random() * 35,
      size: 1.6 + Math.random() * 3.2,
      pace: fast ? 0.95 + Math.random() * 0.45 : 0.18 + Math.random() * 0.22,
      pacePhase: Math.random() * Math.PI * 2,
      paceRate: 0.004 + Math.random() * 0.01,
    });
  }
  if (flies.length > count) flies.length = count;
}

/** Soft blink envelope: mostly dark, occasional green flare. */
function fireflyBlink(phase: number): number {
  const wave = Math.sin(phase) * 0.5 + 0.5;
  const sharp = Math.pow(wave, 8);
  const secondary = Math.pow(Math.sin(phase * 0.37 + 1.7) * 0.5 + 0.5, 14);
  return Math.min(1, sharp * 0.85 + secondary * 0.55);
}

function drawFireflies(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  flies: Firefly[],
) {
  if (w < 2 || h < 2) return;

  let energy = 0;
  const band = Math.min(40, data.length);
  for (let i = 0; i < band; i++) energy += data[i];
  energy = energy / band / 255;

  // Fewer flies — calmer field
  ensureFireflies(flies, w, h, 28 + Math.floor(energy * 18));

  for (const f of flies) {
    f.pacePhase += f.paceRate;
    // Alternate each fly between its slow and fast poles
    const swing = 0.5 + 0.5 * Math.sin(f.pacePhase);
    const speedMul = f.pace * (0.35 + swing * 1.35);

    f.phase += (0.018 + energy * 0.03 + f.size * 0.002) * (0.7 + speedMul * 0.4);
    const blink = fireflyBlink(f.phase);
    const lit = blink > 0.04;

    f.vx += (Math.random() - 0.5) * 0.04 * speedMul;
    f.vy += (Math.random() - 0.5) * 0.04 * speedMul;
    f.vx += Math.sin(f.phase * 0.35) * 0.008 * speedMul;
    f.vy += Math.cos(f.phase * 0.28) * 0.008 * speedMul;
    f.vx *= 0.992;
    f.vy *= 0.992;

    const drift = (0.22 + energy * 0.55) * speedMul;
    f.x += f.vx * drift;
    f.y += f.vy * drift;

    if (f.x < -12) f.x = w + 12;
    else if (f.x > w + 12) f.x = -12;
    if (f.y < -12) f.y = h + 12;
    else if (f.y > h + 12) f.y = -12;

    if (!lit) continue;

    const gHue = 105 + (f.hue - 110) * 0.5 + energy * 20;
    const r = f.size * (0.9 + blink * 2.2 + energy * 1.1);
    const alpha = 0.15 + blink * 0.9;

    const bloom = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 7);
    bloom.addColorStop(0, `hsla(${gHue}, 100%, 65%, ${alpha})`);
    bloom.addColorStop(0.25, `hsla(${gHue + 15}, 100%, 45%, ${alpha * 0.55})`);
    bloom.addColorStop(0.55, `hsla(${gHue - 10}, 90%, 35%, ${alpha * 0.18})`);
    bloom.addColorStop(1, `hsla(${gHue}, 100%, 30%, 0)`);
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r * 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsla(${gHue + 5}, 100%, 75%, ${Math.min(1, alpha + 0.2)})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, Math.max(1, r * 0.35), 0, Math.PI * 2);
    ctx.fill();

    if (blink > 0.7 && energy > 0.25 && speedMul > 0.7) {
      const ox = f.vx * 8 * speedMul;
      const oy = f.vy * 8 * speedMul;
      ctx.fillStyle = `hsla(${gHue + 40}, 100%, 55%, ${blink * 0.2})`;
      ctx.beginPath();
      ctx.arc(f.x - ox, f.y - oy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function AudioVisualizer({
  audioRef,
  isPlayingContext,
  trackKey = 0,
  modeOverride = null,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const modeRef = useRef<VizMode>("rings");
  const firefliesRef = useRef<Firefly[]>([]);
  const rushRef = useRef<RushState>({
    obstacles: [],
    shake: 0,
    flash: 0,
    distance: 0,
  });
  const [mode, setMode] = useState<VizMode>("rings");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (modeOverride) setMode(modeOverride);
  }, [modeOverride]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    window.addEventListener("resize", resize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [audioRef]);

  useEffect(() => {
    const sync = () => {
      const frame = frameRef.current;
      setIsFullscreen(!!frame && getFullscreenElement() === frame);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      if (getFullscreenElement() === frame) {
        await exitFullscreen();
      } else {
        await requestFullscreen(frame);
      }
    } catch {
      /* user gesture / browser policy */
    }
  }, []);

  const cycleMode = useCallback(() => {
    setMode((current) => {
      const idx = VIZ_MODES.findIndex((m) => m.id === current);
      return VIZ_MODES[(idx + 1) % VIZ_MODES.length].id;
    });
  }, []);

  useEffect(() => {
    if (!isPlayingContext) return;
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { audioCtx, analyser } = getOrCreateAudioGraph(audio);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    void audioCtx.resume();

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      const currentMode = modeRef.current;

      if (currentMode === "fireflies") {
        // Near-black field; very slow fade = long acid trails
        ctx.fillStyle = "rgba(0, 0, 0, 0.045)";
        ctx.fillRect(0, 0, w, h);
      } else if (currentMode === "rush") {
        // Rush draws its own trail fill
      } else {
        ctx.fillStyle =
          currentMode === "wave" ? "rgba(0, 0, 0, 0.2)" : "rgba(0, 0, 0, 0.08)";
        ctx.fillRect(0, 0, w, h);
      }

      hueRef.current = (hueRef.current + 0.4) % 360;
      const hue = hueRef.current;

      if (currentMode === "wave") {
        analyser.getByteTimeDomainData(timeData);
        drawWave(ctx, timeData, w, h, hue);
      } else if (currentMode === "rush") {
        analyser.getByteFrequencyData(freqData);
        drawRush(ctx, freqData, w, h, rushRef.current);
      } else {
        analyser.getByteFrequencyData(freqData);
        if (currentMode === "spikes") drawSpikes(ctx, freqData, w, h, hue);
        else if (currentMode === "fireflies")
          drawFireflies(ctx, freqData, w, h, firefliesRef.current);
        else drawRings(ctx, freqData, w, h, hue);
      }
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioRef, isPlayingContext, trackKey]);

  const modeLabel =
    VIZ_MODES.find((m) => m.id === mode)?.label ?? "RINGS";

  return (
    <div
      ref={frameRef}
      className={`viz-frame viz-frame--compact viz-frame--mode-${mode}${isFullscreen ? " viz-frame--fullscreen" : ""}`}
      data-viz-mode={mode}
    >
      <canvas ref={canvasRef} className="visualizer-canvas" />
      <div className="viz-controls">
        <button
          type="button"
          className="viz-control-btn"
          onClick={cycleMode}
          aria-label={`Visualization mode: ${modeLabel}. Click to change.`}
          title="Change visualization"
        >
          {modeLabel}
        </button>
        <button
          type="button"
          className="viz-control-btn"
          onClick={() => void toggleFullscreen()}
          aria-pressed={isFullscreen}
          aria-label={
            isFullscreen ? "Exit full screen" : "Full screen visualizer"
          }
          title={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          {isFullscreen ? "EXIT" : "FULL"}
        </button>
      </div>
    </div>
  );
}
