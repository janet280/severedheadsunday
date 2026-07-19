import { useCallback, useEffect, useRef, useState } from "react";
import { getOrCreateAudioGraph } from "../audioGraph";

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlayingContext: boolean;
  /** Remount media binding when the active track / audio node changes. */
  trackKey?: number;
};

type VizMode = "rings" | "wave" | "spikes" | "fireflies";

const VIZ_MODES: { id: VizMode; label: string }[] = [
  { id: "rings", label: "RINGS" },
  { id: "wave", label: "WAVE" },
  { id: "spikes", label: "SPIKES" },
  { id: "fireflies", label: "FLIES" },
];

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
  const centerX = w / 2;
  const centerY = h / 2;
  const count = Math.min(72, data.length);
  const base = Math.min(w, h) * 0.12;

  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * data.length);
    const v = data[idx] / 255;
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const len = base + v * Math.min(w, h) * 0.42;
    const x2 = centerX + Math.cos(angle) * len;
    const y2 = centerY + Math.sin(angle) * len;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * base * 0.4, centerY + Math.sin(angle) * base * 0.4);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `hsla(${(hue + i * 5) % 360}, 90%, ${45 + v * 30}%, ${0.4 + v * 0.5})`;
    ctx.lineWidth = 2 + v * 4;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, base * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.2)`;
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
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const modeRef = useRef<VizMode>("rings");
  const firefliesRef = useRef<Firefly[]>([]);
  const [mode, setMode] = useState<VizMode>("rings");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
