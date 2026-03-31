import { useRef, useEffect } from 'react';
import type { Track } from '../types';

interface WaveformDisplayProps {
  track: Track | null;
  currentTime: number;
  duration: number;
  color: string;
}

export default function WaveformDisplay({ track, currentTime, duration, color }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10, 10, 18, 0.0)';
    ctx.fillRect(0, 0, W, H);

    if (!track?.waveformData || track.waveformData.length === 0) {
      ctx.strokeStyle = `${color}33`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      for (let x = 0; x < W; x++) {
        ctx.lineTo(x, H / 2 + Math.sin(x * 0.1) * H * 0.1);
      }
      ctx.stroke();
      if (!track) {
        ctx.fillStyle = 'rgba(180, 79, 255, 0.15)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Load a track to see waveform', W / 2, H / 2 + 4);
      }
      return;
    }

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
  }, [track, currentTime, duration, color]);

  return (
    <div className="waveform-container h-12 w-full overflow-hidden">
      <canvas ref={canvasRef} width={400} height={48} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}
