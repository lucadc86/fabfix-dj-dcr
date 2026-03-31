interface AutomixPanelProps {
  active: boolean;
  onToggle: () => void;
}

export default function AutomixPanel({ active, onToggle }: AutomixPanelProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 tracking-widest">AUTOMIX</span>
      <button onClick={onToggle} className={`relative w-12 h-6 rounded-full transition-all duration-300 ${active ? 'bg-purple-600' : 'bg-gray-800'}`} style={active ? { boxShadow: '0 0 12px rgba(180, 79, 255, 0.6)' } : {}}>
        <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 shadow-lg" style={{ left: active ? '26px' : '2px' }} />
      </button>
      {active && <span className="text-[10px] font-bold text-purple-400 animate-pulse">● ON</span>}
    </div>
  );
}
