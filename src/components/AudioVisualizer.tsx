import { useEffect, useRef } from "react";
import { getOrCreateAudioGraph } from "../audioGraph";

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlayingContext: boolean;
};

export function AudioVisualizer({ audioRef, isPlayingContext }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, [audioRef]);

  useEffect(() => {
    if (!isPlayingContext) return;
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { audioCtx, analyser } = getOrCreateAudioGraph(audio);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    void audioCtx.resume();

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      hueRef.current = (hueRef.current + 0.4) % 360;
      const hue = hueRef.current;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const radius = (v * canvas.height) / 1.8 + i * 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `hsla(${(hue + i * 12) % 360}, 90%, 50%, 0.15)`;
        ctx.lineWidth = 15;
        ctx.stroke();

        if (v > 1.15) {
          ctx.fillStyle = `hsla(${(hue + 180) % 360}, 100%, 60%, 0.03)`;
          ctx.beginPath();
          ctx.arc(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            v * 70,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [audioRef, isPlayingContext]);

  return <canvas ref={canvasRef} className="visualizer-canvas" />;
}
