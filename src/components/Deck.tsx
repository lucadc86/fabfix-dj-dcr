import { useRef, useEffect, useState, useCallback } from 'react';
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
  onScratch?: (deltaSeconds: number) => void;
  onDrumPad: (padId: string) => void;
  onLoop: (active: boolean, start?: number, end?: number) => void;
}

const DRUM_PADS = [
  { id: 'kick',    label: 'KICK',    color: '#b44fff' },
  { id: 'snare',   label: 'SNARE',   color: '#ffa500' },
  { id: 'clap',    label: 'CLAP',    color: '#39ff14' },
  { id: 'hihat',   label: 'HI-HAT',  color: '#00f5ff' },
  { id: 'rimshot', label: 'RIM',     color: '#ffff00' },
  { id: 'cash',    label: 'CASH',    color: '#ff8c00' },
  { id: 'gunshot', label: 'GUNSHOT', color: '#ff2d78' },
  { id: 'openhat', label: 'OPEN HH', color: '#44ddff' },
] as const;

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TurntablePlatter({ rotation, isPlaying, jogActive, accentColor, deckId, bpm }: {
  rotation: number;
  isPlaying: boolean;
  jogActive: boolean;
  accentColor: string;
  deckId: string;
  bpm: number;
}) {
  const transitionStyle = isPlaying && !jogActive ? 'none' : 'transform 0.05s linear';
  const strobeCount = 16;

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`rim-${deckId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="78%" stopColor="#14141e" />
          <stop offset="85%" stopColor="#2a2a3a" />
          <stop offset="92%" stopColor="#1e1e28" />
          <stop offset="100%" stopColor="#0d0d14" />
        </radialGradient>
        <radialGradient id={`platter-${deckId}`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#181828" />
          <stop offset="100%" stopColor="#0a0a14" />
        </radialGradient>
        <filter id={`glow-${deckId}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer rim */}
      <circle cx="80" cy="80" r="79" fill={`url(#rim-${deckId})`} />

      {/* Rim grip lines */}
      {Array.from({ length: 32 }, (_, i) => {
        const angle = (i / 32) * Math.PI * 2;
        const r1 = 66, r2 = 77;
        return (
          <line key={i}
            x1={80 + Math.cos(angle) * r1} y1={80 + Math.sin(angle) * r1}
            x2={80 + Math.cos(angle) * r2} y2={80 + Math.sin(angle) * r2}
            stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
        );
      })}

      {/* Stroboscopic dots on outer rim — static */}
      {Array.from({ length: strobeCount }, (_, i) => {
        const angle = (i / strobeCount) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle key={i}
            cx={80 + Math.cos(angle) * 72} cy={80 + Math.sin(angle) * 72}
            r="2.2"
            fill={accentColor}
            opacity={i % 2 === 0 ? (isPlaying ? 0.9 : 0.4) : 0.15}
            style={{ filter: i % 2 === 0 && isPlaying ? `drop-shadow(0 0 3px ${accentColor})` : 'none' }}
          />
        );
      })}

      {/* Rotating platter group */}
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '80px 80px', transition: transitionStyle }}>
        {/* Platter surface */}
        <circle cx="80" cy="80" r="64" fill={`url(#platter-${deckId})`} />

        {/* Vinyl grooves */}
        {[58, 53, 48, 43, 39, 35, 31, 28, 25].map((r, idx) => (
          <circle key={r} cx="80" cy="80" r={r} fill="none"
            stroke={`rgba(180,79,255,${0.04 + idx * 0.008})`} strokeWidth="0.7" />
        ))}

        {/* Platter reflection highlight */}
        <ellipse cx="68" cy="62" rx="10" ry="5"
          fill="rgba(255,255,255,0.04)"
          style={{ transform: 'rotate(-25deg)', transformOrigin: '80px 80px' }} />

        {/* Center label area */}
        <circle cx="80" cy="80" r="22"
          fill={`${accentColor}18`}
          stroke={`${accentColor}55`} strokeWidth="1.5" />

        {/* Needle/position indicator */}
        <line x1="80" y1="58" x2="80" y2="68"
          stroke={accentColor} strokeWidth="3" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }} />

        {/* Spindle */}
        <circle cx="80" cy="80" r="3.5" fill="#050508" stroke={`${accentColor}66`} strokeWidth="1" />
      </g>

      {/* Deck info overlay — does not rotate */}
      <text x="80" y="77" textAnchor="middle" fill={accentColor}
        fontSize="7.5" fontFamily="monospace" fontWeight="bold"
        style={{ pointerEvents: 'none' }}>
        DECK {deckId}
      </text>
      <text x="80" y="88" textAnchor="middle" fill={`${accentColor}99`}
        fontSize="6" fontFamily="monospace"
        style={{ pointerEvents: 'none' }}>
        {bpm > 0 ? `${bpm.toFixed(0)} BPM` : '--- BPM'}
      </text>

      {/* Outer glow ring */}
      <circle cx="80" cy="80" r="79" fill="none"
        stroke={accentColor} strokeWidth="1.5"
        opacity={isPlaying ? 0.5 : 0.15}
        style={{ filter: isPlaying ? `drop-shadow(0 0 6px ${accentColor})` : 'none' }} />
    </svg>
  );
}

export default function Deck({ deckState, side, onPlay, onCue, onSetCue, onSync, onVolume, onGain, onPitch, onEq, onScratch, onDrumPad, onLoop }: DeckProps) {
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
      const nudge = Math.max(-12, Math.min(12, delta * 0.05));
      onPitch(nudge);
    };
    const onUp = () => {
      setJogActive(false);
      if (onScratch && Math.abs(jogAccumRef.current) > 3) {
        onScratch(jogAccumRef.current * 0.05);
      }
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
  const isSynced = deckState.detectedBpm > 0;

  return (
    <div className="h-full flex flex-col neon-border rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: accentColorMuted }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-widest px-2 py-0.5 rounded" style={{ background: accentColorMuted, color: accentColor, border: `1px solid ${accentColorMuted}` }}>DECK {deckState.id}</span>
          {deckState.track && <span className="text-[10px] text-gray-400 truncate max-w-[130px]">{deckState.track.title}</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-mono font-bold" style={{ color: accentColor }}>{deckState.detectedBpm > 0 ? deckState.detectedBpm.toFixed(1) : '---'}</div>
            <div className="text-[9px] text-gray-500 tracking-widest">BPM</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-purple-400">{formatTime(deckState.currentTime)}</div>
            <div className="text-[9px] text-gray-600 font-mono">/ {formatTime(deckState.duration)}</div>
          </div>
        </div>
      </div>

      {/* Scrolling waveform display */}
      <WaveformDisplay track={deckState.track} currentTime={deckState.currentTime} duration={deckState.duration} color={accentColor} isPlaying={deckState.isPlaying} loopStart={deckState.loopStart} loopEnd={deckState.loopEnd} loopActive={deckState.loop} />

      {/* Progress bar */}
      <div className="h-1 bg-gray-900 mx-3 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-none" style={{ width: `${progress * 100}%`, background: `linear-gradient(to right, ${accentColor}, #b44fff)` }} />
      </div>

      {/* Transport buttons */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button onClick={onCue} className="btn-cue flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wider">⏮ CUE</button>
        <button onClick={onSetCue} className="btn-set px-2.5 py-2.5 rounded-lg text-[10px] font-bold" title="Imposta CUE">SET</button>
        <button
          onClick={onPlay}
          className={`flex-1 py-2.5 rounded-lg text-sm font-black tracking-wider transition-all ${deckState.isPlaying ? 'playing' : ''}`}
          style={deckState.isPlaying
            ? { background: 'rgba(57,255,20,0.3)', border: '1px solid #39ff14', color: '#39ff14', boxShadow: '0 0 16px rgba(57,255,20,0.5)' }
            : { background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.4)', color: '#39ff14' }}
        >
          {deckState.isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={onSync}
          className="flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all"
          style={isSynced
            ? { background: 'rgba(255,165,0,0.25)', border: '1px solid rgba(255,165,0,0.7)', color: '#ffa500', boxShadow: '0 0 10px rgba(255,165,0,0.4)' }
            : { background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', color: '#ffa500' }}
          title={isSynced ? `BPM: ${deckState.detectedBpm.toFixed(1)}` : 'Carica un brano per il SYNC'}
        >
          ⟳ SYNC
        </button>
      </div>

      <div className="flex gap-2 px-2 pb-1 flex-1">
        {/* Left: Turntable platter */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div
            style={{ cursor: 'grab', userSelect: 'none', width: 160, height: 160 }}
            onMouseDown={handleJogMouseDown}
            title="Trascina per scratch/nudge"
          >
            <TurntablePlatter
              rotation={rotation}
              isPlaying={deckState.isPlaying}
              jogActive={jogActive}
              accentColor={accentColor}
              deckId={deckState.id}
              bpm={deckState.detectedBpm}
            />
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-1.5 w-full px-1">
            <span className="text-[9px] text-gray-500 tracking-widest w-7">VOL</span>
            <input type="range" min="0" max="1" step="0.01" value={deckState.volume} onChange={e => onVolume(parseFloat(e.target.value))} className={`slider-neon flex-1 ${side === 'left' ? 'slider-cyan' : ''}`} />
            <span className="text-[9px] font-mono w-8 text-right" style={{ color: accentColor }}>{Math.round(deckState.volume * 100)}%</span>
          </div>

          {/* Pitch slider */}
          <div className="flex items-center gap-1.5 w-full px-1">
            <span className="text-[9px] text-gray-500 tracking-widest w-7">PITCH</span>
            <input type="range" min="-12" max="12" step="0.1" value={deckState.pitch} onChange={e => onPitch(parseFloat(e.target.value))} className="slider-neon flex-1" />
            <span className="text-[9px] font-mono w-8 text-right" style={{ color: accentColor }}>{deckState.pitch > 0 ? '+' : ''}{deckState.pitch.toFixed(1)}</span>
          </div>
        </div>

        {/* Right: EQ knobs + pad section */}
        <div className="flex-1 flex flex-col gap-1.5">
          {/* EQ Knobs */}
          <div className="flex gap-1 items-center justify-around pt-1">
            {(['high', 'mid', 'low'] as const).map(band => (
              <div key={band} className="flex flex-col items-center gap-0.5">
                <Knob
                  value={deckState.eq[band]}
                  min={-1}
                  max={1}
                  onChange={v => onEq(band, v)}
                  color={accentColor}
                  size={44}
                />
                <span className="text-[8px] font-mono" style={{ color: accentColor }}>
                  {deckState.eq[band] > 0 ? '+' : ''}{(deckState.eq[band] * 15).toFixed(0)}dB
                </span>
                <span className="text-[8px] text-gray-500 uppercase tracking-widest">
                  {{ high: 'ALTI', mid: 'MEDI', low: 'BASSI' }[band]}
                </span>
              </div>
            ))}
            {/* Gain knob */}
            <div className="flex flex-col items-center gap-0.5">
              <Knob
                value={deckState.gain}
                min={0}
                max={1.5}
                onChange={onGain}
                color="#b44fff"
                size={44}
              />
              <span className="text-[8px] font-mono text-purple-400">
                {Math.round(deckState.gain * 100)}%
              </span>
              <span className="text-[8px] text-gray-500 uppercase tracking-widest">GAIN</span>
            </div>
          </div>

          {/* Pad section */}
          <div className="flex-1 flex flex-col">
            {/* Mode buttons */}
            <div className="flex gap-1 mb-1.5">
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

            {padMode === 'loop' ? (
              /* Loop controls */
              <div className="grid grid-cols-2 gap-1">
                {[
                  { label: 'LOOP IN', color: '#00f5ff', action: () => onLoop(false, deckState.currentTime, undefined) },
                  { label: 'LOOP OUT', color: '#ff2d78', action: () => onLoop(true, undefined, deckState.currentTime) },
                  { label: deckState.loop ? '● LOOP ON' : '○ LOOP OFF', color: deckState.loop ? '#39ff14' : '#6b7280', action: () => onLoop(!deckState.loop) },
                  { label: 'CLR LOOP', color: '#ffa500', action: () => onLoop(false, 0, 0) },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    className="py-2 rounded text-[9px] font-bold tracking-wide transition-all"
                    style={{
                      background: `${btn.color}18`,
                      border: `1px solid ${btn.color}55`,
                      color: btn.color,
                      boxShadow: `0 0 4px ${btn.color}22`,
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
                {/* Loop info */}
                <div className="col-span-2 text-center text-[9px] font-mono text-gray-600 py-1">
                  {deckState.loopStart > 0 || deckState.loopEnd > 0
                    ? `IN: ${formatTime(deckState.loopStart)} → OUT: ${formatTime(deckState.loopEnd)}`
                    : 'Nessun loop impostato'}
                </div>
                {/* Loop size shortcuts (requires BPM) */}
                {deckState.detectedBpm > 0 && [0.5, 1, 2, 4].map(bars => (
                  <button
                    key={bars}
                    onClick={() => {
                      const barLen = (60 / deckState.detectedBpm) * 4 * bars;
                      const start = deckState.currentTime;
                      onLoop(true, start, start + barLen);
                    }}
                    className="py-1 rounded text-[9px] font-bold transition-all"
                    style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}44`, color: `${accentColor}cc` }}
                  >
                    {bars}♩
                  </button>
                ))}
                {deckState.detectedBpm === 0 && (
                  <div className="col-span-2 text-center text-[9px] text-gray-700 py-1">BPM necessario per loop a barre</div>
                )}
              </div>
            ) : (
              /* Drum pads grid */
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
