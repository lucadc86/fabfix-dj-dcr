interface AutomixPanelProps {
  active: boolean;
  onToggle: () => void;
  fadeTime: number;
  onFadeTimeChange: (t: number) => void;
  bpmSync: boolean;
  onBpmSyncToggle: () => void;
}

const FADE_OPTIONS = [5, 10, 15, 30] as const;

export default function AutomixPanel({ active, onToggle, fadeTime, onFadeTimeChange, bpmSync, onBpmSyncToggle }: AutomixPanelProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-purple-900/40" style={{ background: 'rgba(180,79,255,0.06)' }}>
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 tracking-widest font-semibold">AUTOMIX</span>
        <button
          onClick={onToggle}
          className="relative w-12 h-6 rounded-full transition-all duration-300"
          style={active ? { background: '#b44fff', boxShadow: '0 0 14px rgba(180,79,255,0.7)' } : { background: '#1a1a2e' }}
        >
          <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 shadow-lg" style={{ left: active ? '26px' : '2px' }} />
        </button>
        {active && <span className="text-[10px] font-bold animate-pulse" style={{ color: '#b44fff' }}>● ON</span>}
      </div>

      {/* Fade time */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-gray-600 tracking-widest">FADE</span>
        <div className="flex gap-0.5">
          {FADE_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => onFadeTimeChange(t)}
              className="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all"
              style={fadeTime === t
                ? { background: 'rgba(180,79,255,0.35)', border: '1px solid rgba(180,79,255,0.7)', color: '#d88fff', boxShadow: '0 0 6px rgba(180,79,255,0.4)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4b5563' }}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>

      {/* BPM Sync toggle */}
      <button
        onClick={onBpmSyncToggle}
        className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest transition-all"
        style={bpmSync
          ? { background: 'rgba(255,165,0,0.2)', border: '1px solid rgba(255,165,0,0.5)', color: '#ffa500', boxShadow: '0 0 6px rgba(255,165,0,0.3)' }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4b5563' }}
      >
        BPM SYNC
      </button>
    </div>
  );
}
