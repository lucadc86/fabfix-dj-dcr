import { useRef, useEffect } from 'react';
import type { Track } from '../types';

interface WaveformDisplayProps {
  track: Track | null;
  currentTime: number;
  duration: number;
  color: string;
  isPlaying?: boolean;
  loopStart?: number;
  loopEnd?: number;
  loopActive?: boolean;
}

export default function WaveformDisplay({ track, currentTime, duration, color, isPlaying = false, loopStart = 0, loopEnd = 0, loopActive = false }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      if (!track?.waveformData || track.waveformData.length === 0) {
        // Animated placeholder for YouTube or unloaded tracks
        ctx.strokeStyle = isPlaying ? color : `${color}44`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        for (let x = 0; x < W; x++) {
          const amp = isPlaying ? H * 0.38 : H * 0.08;
          const y = H / 2
            + Math.sin((x + offsetRef.current) * 0.04) * amp * 0.6
            + Math.sin((x + offsetRef.current * 1.3) * 0.018) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.shadowColor = isPlaying ? color : 'transparent';
        ctx.shadowBlur = isPlaying ? 6 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (!track) {
          ctx.fillStyle = 'rgba(180, 79, 255, 0.18)';
          ctx.font = '10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('Carica un brano', W / 2, H / 2 + 4);
        }

        if (isPlaying) {
          offsetRef.current += 2;
          animRef.current = requestAnimationFrame(draw);
        }
        return;
      }

      // ── Scrolling waveform: playhead fixed at W/2 ──
      const data = track.waveformData;
      const totalSamples = data.length;
      const progress = duration > 0 ? currentTime / duration : 0;
      const centerSample = progress * totalSamples;

      // How many waveform samples to show across the full canvas
      // Show ~12 seconds worth of audio centered on playhead
      const visibleSeconds = Math.min(duration, 12);
      const samplesPerSecond = totalSamples / (duration || 1);
      const halfWindow = (visibleSeconds / 2) * samplesPerSecond;

      const playheadX = W / 2;

      // Background time grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= W; i += W / 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, H);
        ctx.stroke();
      }

      // Draw loop region
        if (loopActive && loopEnd > loopStart && duration > 0) {
        const loopStartSample = (loopStart / duration) * totalSamples;
        const loopEndSample = (loopEnd / duration) * totalSamples;
        const lx1 = playheadX + ((loopStartSample - centerSample) / halfWindow) * (W / 2);
        const lx2 = playheadX + ((loopEndSample - centerSample) / halfWindow) * (W / 2);
        if (lx2 > 0 && lx1 < W) {
          ctx.fillStyle = 'rgba(57,255,20,0.12)';
          ctx.fillRect(Math.max(0, lx1), 0, Math.min(W, lx2) - Math.max(0, lx1), H);
          ctx.strokeStyle = 'rgba(57,255,20,0.5)';
          ctx.lineWidth = 1;
          if (lx1 >= 0 && lx1 <= W) { ctx.beginPath(); ctx.moveTo(lx1, 0); ctx.lineTo(lx1, H); ctx.stroke(); }
          if (lx2 >= 0 && lx2 <= W) { ctx.beginPath(); ctx.moveTo(lx2, 0); ctx.lineTo(lx2, H); ctx.stroke(); }
        }
      }

      // Draw waveform bars
      for (let x = 0; x < W; x++) {
        const sampleOffset = ((x - playheadX) / (W / 2)) * halfWindow;
        const sampleIdx = Math.round(centerSample + sampleOffset);
        if (sampleIdx < 0 || sampleIdx >= totalSamples) continue;

        // Average a few samples for smoother look
        let max = 0;
        const spread = Math.max(1, Math.ceil(halfWindow / (W / 2)));
        for (let s = 0; s < spread; s++) {
          const idx = sampleIdx + s;
          if (idx >= 0 && idx < totalSamples) max = Math.max(max, Math.abs(data[idx]));
        }

        const barH = max * H * 0.88;
        const isPast = x <= playheadX;
        if (isPast) {
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 1;
        } else {
          ctx.fillStyle = `${color}3a`;
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(x, (H - barH) / 2, 1, Math.max(1, barH));
      }

      ctx.shadowBlur = 0;

      // Playhead line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, H);
      ctx.stroke();

      // Playhead glow wings
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.moveTo(playheadX - 2, 0); ctx.lineTo(playheadX - 2, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(playheadX + 2, 0); ctx.lineTo(playheadX + 2, H); ctx.stroke();
      ctx.globalAlpha = 1;

      // Time labels
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      const secStep = Math.ceil(visibleSeconds / 4);
      for (let s = -Math.ceil(visibleSeconds / 2); s <= Math.ceil(visibleSeconds / 2); s += secStep) {
        const labelTime = currentTime + s;
        if (labelTime < 0 || labelTime > duration) continue;
        const lx = playheadX + (s / (visibleSeconds / 2)) * (W / 2);
        const m = Math.floor(labelTime / 60);
        const sec = Math.floor(labelTime % 60);
        ctx.fillText(`${m}:${sec.toString().padStart(2, '0')}`, lx, H - 2);
      }
    };

    cancelAnimationFrame(animRef.current);
    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, [track, currentTime, duration, color, isPlaying, loopStart, loopEnd, loopActive]);

  return (
    <div className="waveform-container w-full overflow-hidden" style={{ height: 56 }}>
      <canvas ref={canvasRef} width={600} height={56} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}
