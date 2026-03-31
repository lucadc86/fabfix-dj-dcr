import { useRef, useEffect, useState } from 'react';
import type { DeckState } from '../types';
import WaveformDisplay from './WaveformDisplay';
import Knob from './Knob';

interface DeckProps {
  deckState: DeckState;
  side: 'left' | 'right';
  onPlay: () => void;
  onCue: () => void;
  onSetCue: () => void;
  onSync: () => void;
  onVolume: (v: number) => void;
  onGain: (g: number) => void;
  onPitch: (p: number) => void;
  onEq: (band: 'low' | 'mid' | 'high', v: number) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Deck({ deckState, side, onPlay, onCue, onSetCue, onSync, onVolume, onGain, onPitch, onEq }: DeckProps) {
  const vinylRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (deckState.isPlaying) {
      const animate = () => { setRotation(r => (r + 0.5) % 360); animFrameRef.current = requestAnimationFrame(animate); };
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [deckState.isPlaying]);

  const progress = deckState.duration > 0 ? deckState.currentTime / deckState.duration : 0;
  const accentColor = side === 'left' ? '#00f5ff' : '#ff2d78';
  const accentColorMuted = side === 'left' ? 'rgba(0,245,255,0.2)' : 'rgba(255,45,120,0.2)';

  return (
    <div className="h-full flex flex-col neon-border rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: accentColorMuted }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-widest px-2 py-0.5 rounded" style={{ background: accentColorMuted, color: accentColor, border: `1px solid ${accentColorMuted}` }}>DECK {deckState.id}</span>
          {deckState.track && <span className="text-xs text-gray-400 truncate max-w-[120px]">{deckState.track.title}</span>}
        </div>
        <div className="text-right">
          <div className="text-lg font-mono font-bold" style={{ color: accentColor }}>{deckState.detectedBpm > 0 ? deckState.detectedBpm.toFixed(1) : '---'}</div>
          <div className="text-[9px] text-gray-500 tracking-widest">BPM</div>
        </div>
      </div>

      <div className="flex gap-2 p-2 flex-1">
        <div className="flex flex-col items-center gap-2">
          <div className="relative" style={{ width: 110, height: 110 }}>
            <div ref={vinylRef} className="vinyl-record w-full h-full" style={{ transform: `rotate(${rotation}deg)`, transition: deckState.isPlaying ? 'none' : 'transform 0.3s ease' }}>
              {[90, 80, 70, 60, 50, 42].map(size => (
                <div key={size} className="vinyl-grooves absolute" style={{ width: size + '%', height: size + '%', top: `${(100 - size) / 2}%`, left: `${(100 - size) / 2}%`, borderColor: side === 'left' ? 'rgba(0,245,255,0.06)' : 'rgba(255,45,120,0.06)' }} />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle, ${accentColor}33 0%, ${accentColor}11 100%)`, border: `1px solid ${accentColor}66` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
                </div>
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-mono font-bold" style={{ color: accentColor }}>{formatTime(deckState.currentTime)}</div>
            <div className="text-[9px] text-gray-600 font-mono">/ {formatTime(deckState.duration)}</div>
          </div>
          <div className="h-1 rounded-full bg-gray-800 overflow-hidden" style={{ width: 110 }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: `linear-gradient(to right, ${accentColor}, #b44fff)` }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <WaveformDisplay track={deckState.track} currentTime={deckState.currentTime} duration={deckState.duration} color={accentColor} />
          <div className="flex items-center gap-1.5">
            <button onClick={onCue} className="btn-cue flex-1 py-2 rounded-lg text-xs font-bold tracking-wider">CUE</button>
            <button onClick={onSetCue} className="btn-neon px-2 py-2 rounded-lg text-[10px] font-bold" title="Imposta punto CUE">SET</button>
            <button onClick={onPlay} className={`btn-play flex-1 py-2 rounded-lg text-xs font-bold tracking-wider ${deckState.isPlaying ? 'playing' : ''}`}>{deckState.isPlaying ? '⏸ PAUSA' : '▶ PLAY'}</button>
            <button onClick={onSync} className="btn-sync flex-1 py-2 rounded-lg text-xs font-bold tracking-wider">SYNC</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 tracking-widest w-10">PITCH</span>
            <input type="range" min="-12" max="12" step="0.1" value={deckState.pitch} onChange={e => onPitch(parseFloat(e.target.value))} className="slider-neon flex-1" />
            <span className="text-[10px] font-mono w-10 text-right" style={{ color: accentColor }}>{deckState.pitch > 0 ? '+' : ''}{deckState.pitch.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 tracking-widest w-10">VOL</span>
            <input type="range" min="0" max="1" step="0.01" value={deckState.volume} onChange={e => onVolume(parseFloat(e.target.value))} className="slider-neon flex-1" />
            <span className="text-[10px] font-mono w-10 text-right" style={{ color: accentColor }}>{Math.round(deckState.volume * 100)}%</span>
          </div>
          <div className="flex gap-2 items-end">
            {(['high', 'mid', 'low'] as const).map(band => (
              <div key={band} className="flex flex-col items-center gap-1 flex-1">
                <Knob value={deckState.eq[band]} min={-1} max={1} onChange={v => onEq(band, v)} color={accentColor} size={32} />
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">{{ high: 'ALTI', mid: 'MEDI', low: 'BASSI' }[band]}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1 flex-1">
              <Knob value={deckState.gain} min={0} max={1.5} onChange={onGain} color="#b44fff" size={32} />
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">GAIN</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
