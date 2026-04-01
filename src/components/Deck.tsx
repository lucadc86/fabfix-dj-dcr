import { useRef, useEffect, useState, useCallback } from 'react';
import type { DeckState } from '../types';
import WaveformDisplay from './WaveformDisplay';

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
  onScratch?: (deltaSeconds: number) => void;
  onDrumPad: (padId: string) => void;
}

const DRUM_PADS = [
  { id: 'kick',    label: 'KICK',    color: '#b44fff' },
  { id: 'snare',   label: 'SNARE',   color: '#ffa500' },
  { id: 'clap',    label: 'CLAP',    color: '#39ff14' },
  { id: 'hihat',   label: 'HI-HAT',  color: '#00f5ff' },
  { id: 'rimshot', label: 'RIM',     color: '#ffff00' },
  { id: 'cash',    label: 'CASH',    color: '#ff8c00' },
  { id: 'gunshot', label: 'GUNSHOT', color: '#ff2d78' },
  { id: 'hihat',   label: 'OPEN HH', color: '#44ddff' },
] as const;

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Deck({ deckState, side, onPlay, onCue, onSetCue, onSync, onVolume, onGain, onPitch, onEq, onScratch, onDrumPad }: DeckProps) {
  const vinylRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [jogActive, setJogActive] = useState(false);
  const animFrameRef = useRef<number>(0);
  const jogStartXRef = useRef(0);
  const jogStartRotRef = useRef(0);
  const jogAccumRef = useRef(0);
  const [padMode, setPadMode] = useState<'hotcue' | 'loop' | 'sampler'>('sampler');
  const [activePad, setActivePad] = useState<string | null>(null);

  useEffect(() => {
    if (deckState.isPlaying && !jogActive) {
      const animate = () => { setRotation(r => (r + 0.5) % 360); animFrameRef.current = requestAnimationFrame(animate); };
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [deckState.isPlaying, jogActive]);

  const handleJogMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setJogActive(true);
    jogStartXRef.current = e.clientX;
    jogStartRotRef.current = rotation;
    jogAccumRef.current = 0;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - jogStartXRef.current;
      jogAccumRef.current = delta;
      setRotation((jogStartRotRef.current + delta * 0.8) % 360);
      // Nudge pitch while dragging (temporary speed change)
      const nudge = Math.max(-12, Math.min(12, delta * 0.05));
      onPitch(nudge);
    };
    const onUp = () => {
      setJogActive(false);
      // Scratch: seek by accumulated movement
      if (onScratch && Math.abs(jogAccumRef.current) > 3) {
        onScratch(jogAccumRef.current * 0.05);
      }
      // Return pitch to zero after jog
      onPitch(0);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rotation, onPitch, onScratch]);

  const progress = deckState.duration > 0 ? deckState.currentTime / deckState.duration : 0;
  const accentColor = side === 'left' ? '#00f5ff' : '#ff2d78';
  const accentColorMuted = side === 'left' ? 'rgba(0,245,255,0.2)' : 'rgba(255,45,120,0.2)';
  const sliderClass = side === 'left' ? 'slider-vertical cyan' : 'slider-vertical';

  return (
    <div className="h-full flex flex-col neon-border rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)' }}>
      {/* Header */}
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
        {/* Left column: vinyl + time */}
        <div className="flex flex-col items-center gap-2">
          {/* Vinyl jog wheel */}
          <div
            ref={vinylRef}
            className="relative vinyl-record"
            style={{ width: 110, height: 110, cursor: 'grab', userSelect: 'none' }}
            onMouseDown={handleJogMouseDown}
            title="Trascina per scratch/nudge"
          >
            <div style={{ width: '100%', height: '100%', transform: `rotate(${rotation}deg)`, transition: deckState.isPlaying && !jogActive ? 'none' : 'transform 0.05s linear', borderRadius: '50%', position: 'relative' }}>
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
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-gray-800 overflow-hidden" style={{ width: 110 }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: `linear-gradient(to right, ${accentColor}, #b44fff)` }} />
          </div>
        </div>

        {/* Right column: waveform, controls, sliders */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Waveform */}
          <WaveformDisplay track={deckState.track} currentTime={deckState.currentTime} duration={deckState.duration} color={accentColor} isPlaying={deckState.isPlaying} />

          {/* CUE / SET / PLAY / SYNC */}
          <div className="flex items-center gap-1.5">
            <button onClick={onCue} className="btn-cue flex-1 py-2 rounded-lg text-xs font-bold tracking-wider">CUE</button>
            <button onClick={onSetCue} className="btn-set px-2 py-2 rounded-lg text-[10px] font-bold" title="Imposta punto CUE">SET</button>
            <button onClick={onPlay} className={`btn-play flex-1 py-2 rounded-lg text-xs font-bold tracking-wider ${deckState.isPlaying ? 'playing' : ''}`}>{deckState.isPlaying ? '⏸ PAUSA' : '▶ PLAY'}</button>
            <button onClick={onSync} className="btn-sync flex-1 py-2 rounded-lg text-xs font-bold tracking-wider">SYNC</button>
          </div>

          {/* Pitch */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 tracking-widest w-10">PITCH</span>
            <input type="range" min="-12" max="12" step="0.1" value={deckState.pitch} onChange={e => onPitch(parseFloat(e.target.value))} className="slider-neon flex-1" />
            <span className="text-[10px] font-mono w-12 text-right" style={{ color: accentColor }}>{deckState.pitch > 0 ? '+' : ''}{deckState.pitch.toFixed(1)}%</span>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 tracking-widest w-10">VOL</span>
            <input type="range" min="0" max="1" step="0.01" value={deckState.volume} onChange={e => onVolume(parseFloat(e.target.value))} className="slider-neon flex-1" />
            <span className="text-[10px] font-mono w-12 text-right" style={{ color: accentColor }}>{Math.round(deckState.volume * 100)}%</span>
          </div>

          {/* EQ + Gain: vertical sliders */}
          <div className="flex gap-1 items-end justify-between">
            {(['high', 'mid', 'low'] as const).map(band => (
              <div key={band} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[9px] font-mono w-8 text-center" style={{ color: accentColor }}>
                  {deckState.eq[band] > 0 ? '+' : ''}{(deckState.eq[band] * 15).toFixed(0)}
                </span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={deckState.eq[band]}
                  onChange={e => onEq(band, parseFloat(e.target.value))}
                  className={sliderClass}
                  style={{ height: 72 }}
                />
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">{{ high: 'ALTI', mid: 'MEDI', low: 'BASSI' }[band]}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1 flex-1">
              <span className="text-[9px] font-mono w-8 text-center" style={{ color: '#b44fff' }}>
                {Math.round(deckState.gain * 100)}%
              </span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                value={deckState.gain}
                onChange={e => onGain(parseFloat(e.target.value))}
                className="slider-vertical"
                style={{ height: 72 }}
              />
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">GAIN</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sampler Pad Section */}
      <div className="border-t px-2 py-2" style={{ borderColor: accentColorMuted }}>
        {/* Mode buttons */}
        <div className="flex gap-1 mb-2">
          {(['hotcue', 'loop', 'sampler'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setPadMode(mode)}
              className="flex-1 py-1 rounded text-[9px] font-bold tracking-widest transition-all"
              style={padMode === mode
                ? { background: `${accentColor}33`, border: `1px solid ${accentColor}88`, color: accentColor, boxShadow: `0 0 6px ${accentColor}44` }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}
            >
              {{ hotcue: 'HOT CUE', loop: 'LOOP', sampler: 'SAMPLER' }[mode]}
            </button>
          ))}
        </div>
        {/* Drum pads grid */}
        <div className="grid grid-cols-4 gap-1">
          {DRUM_PADS.map((pad, i) => (
            <button
              key={`${pad.id}-${i}`}
              onMouseDown={() => { setActivePad(pad.id + i); if (padMode === 'sampler') onDrumPad(pad.id); }}
              onMouseUp={() => setActivePad(null)}
              onMouseLeave={() => setActivePad(null)}
              className="rounded py-2 text-[9px] font-bold tracking-wide transition-all select-none"
              style={{
                background: activePad === pad.id + i ? `${pad.color}55` : `${pad.color}18`,
                border: `1px solid ${pad.color}66`,
                color: pad.color,
                boxShadow: activePad === pad.id + i ? `0 0 8px ${pad.color}88` : `0 0 4px ${pad.color}22`,
              }}
            >
              {pad.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
