import type { DeckState, MixerState } from '../types';

interface MixerProps {
  mixer: MixerState;
  deckA: DeckState;
  deckB: DeckState;
  onCrossfader: (v: number) => void;
}

function VUMeter({ level, color }: { level: number; color: string }) {
  const bars = 12;
  return (
    <div className="flex flex-col-reverse gap-0.5 h-20">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const active = level >= threshold;
        const isRed = i >= 10;
        const isYellow = i >= 7 && i < 10;
        const barColor = isRed ? '#ff2d78' : isYellow ? '#ffa500' : color;
        return (
          <div key={i} className="rounded-sm transition-all duration-75" style={{ height: 4, background: active ? barColor : 'rgba(255,255,255,0.05)', boxShadow: active ? `0 0 4px ${barColor}` : 'none' }} />
        );
      })}
    </div>
  );
}

export default function Mixer({ mixer, deckA, deckB, onCrossfader }: MixerProps) {
  const levelA = deckA.isPlaying ? deckA.volume * 0.85 + Math.random() * 0.1 : 0;
  const levelB = deckB.isPlaying ? deckB.volume * 0.85 + Math.random() * 0.1 : 0;

  return (
    <div className="h-full flex flex-col neon-border rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)' }}>
      <div className="text-center py-2 border-b border-purple-900/30">
        <span className="text-[10px] tracking-[0.3em] text-purple-500 font-semibold">MIXER</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-between p-3 gap-3">
        <div className="flex gap-4 items-start w-full justify-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-cyan-500 tracking-widest">A</span>
            <div className="flex gap-0.5"><VUMeter level={levelA} color="#00f5ff" /><VUMeter level={levelA * 0.9} color="#00f5ff" /></div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-pink-500 tracking-widest">B</span>
            <div className="flex gap-0.5"><VUMeter level={levelB} color="#ff2d78" /><VUMeter level={levelB * 0.9} color="#ff2d78" /></div>
          </div>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-[9px] text-gray-600 mb-1.5">
            <span className="text-cyan-600">A</span>
            <span className="tracking-widest text-purple-600">XFADE</span>
            <span className="text-pink-600">B</span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={mixer.crossfader} onChange={e => onCrossfader(parseFloat(e.target.value))} className="crossfader-slider" />
          <div className="flex justify-between text-[9px] text-gray-700 mt-1">
            <span>◀</span>
            <span className="font-mono text-purple-600">{Math.round(Math.abs(mixer.crossfader - 0.5) * 200)}% {mixer.crossfader < 0.499 ? 'A' : mixer.crossfader > 0.501 ? 'B' : 'C'}</span>
            <span>▶</span>
          </div>
        </div>
        <div className="w-full">
          <div className="text-[9px] text-purple-500 tracking-widest mb-1.5 text-center">STATO CANALI</div>
          <div className="flex justify-between text-[9px]">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${deckA.isPlaying ? 'bg-cyan-400' : 'bg-gray-800'}`} style={{ boxShadow: deckA.isPlaying ? '0 0 6px #00f5ff' : 'none' }} />
              <span className="text-cyan-600">PLAY</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" style={{ boxShadow: '0 0 4px #b44fff', opacity: 0.7 }} />
              <span className="text-purple-600">MIX</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${deckB.isPlaying ? 'bg-pink-400' : 'bg-gray-800'}`} style={{ boxShadow: deckB.isPlaying ? '0 0 6px #ff2d78' : 'none' }} />
              <span className="text-pink-600">PLAY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
