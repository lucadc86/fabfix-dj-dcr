import { useRef, useEffect } from 'react';
import type { Track } from '../types';

interface WaveformDisplayProps {
  track: Track | null;
  currentTime: number;
  duration: number;
  color: string;
  isPlaying?: boolean;
}

export default function WaveformDisplay({ track, currentTime, duration, color, isPlaying = false }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    let offset = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      if (!track?.waveformData || track.waveformData.length === 0) {
        // Animated waveform for YouTube or unloaded tracks
        ctx.strokeStyle = isPlaying ? color : `${color}44`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        for (let x = 0; x < W; x++) {
          const amp = isPlaying ? H * 0.35 : H * 0.08;
          const freq1 = 0.04;
          const freq2 = 0.02;
          const y = H / 2
            + Math.sin((x + offset) * freq1) * amp * 0.6
            + Math.sin((x + offset * 1.3) * freq2) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.shadowColor = isPlaying ? color : 'transparent';
        ctx.shadowBlur = isPlaying ? 4 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (!track) {
          ctx.fillStyle = 'rgba(180, 79, 255, 0.15)';
          ctx.font = '10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('Carica un brano', W / 2, H / 2 + 4);
        }

        if (isPlaying) {
          offset += 2;
          animRef.current = requestAnimationFrame(draw);
        }
        return;
      }

      // Real waveform
      const data = track.waveformData;
      const progress = duration > 0 ? currentTime / duration : 0;
      const playheadX = progress * W;
      const step = Math.ceil(data.length / W);

      for (let x = 0; x < W; x++) {
        let max = 0;
        for (let i = 0; i < step; i++) {
          const idx = x * step + i;
          if (idx < data.length) max = Math.max(max, Math.abs(data[idx]));
        }
        const barH = max * H * 0.9;
        const isPast = x <= playheadX;
        if (isPast) { ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 2; }
        else { ctx.fillStyle = `${color}44`; ctx.shadowBlur = 0; }
        ctx.fillRect(x, (H - barH) / 2, 1, barH);
      }

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, H);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(playheadX - 2, 0); ctx.lineTo(playheadX - 2, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(playheadX + 2, 0); ctx.lineTo(playheadX + 2, H); ctx.stroke();
      ctx.globalAlpha = 1;
    };

    cancelAnimationFrame(animRef.current);
    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, [track, currentTime, duration, color, isPlaying]);

  return (
    <div className="waveform-container h-12 w-full overflow-hidden">
      <canvas ref={canvasRef} width={400} height={48} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}
