import { useState, useCallback } from 'react';
import type { AudioEngine } from '../audio/engine';

interface Effect {
  id: string;
  name: string;
  active: boolean;
  params: { name: string; key: string; min: number; max: number; value: number; unit: string }[];
  color: string;
}

interface EffectsPanelProps {
  engine: AudioEngine;
}

const INITIAL_EFFECTS: Effect[] = [
  { id: 'filter', name: 'FILTRO', active: false, color: '#b44fff', params: [{ name: 'Taglio', key: 'cutoff', min: 20, max: 20000, value: 2000, unit: 'Hz' }, { name: 'Risonanza', key: 'resonance', min: 0.1, max: 20, value: 1, unit: 'Q' }] },
  { id: 'echo', name: 'ECO', active: false, color: '#00f5ff', params: [{ name: 'Ritardo', key: 'delay', min: 0.05, max: 1, value: 0.3, unit: 's' }, { name: 'Feedback', key: 'feedback', min: 0, max: 0.9, value: 0.4, unit: '' }, { name: 'Mix', key: 'wet', min: 0, max: 1, value: 0.3, unit: '' }] },
  { id: 'reverb', name: 'REVERB', active: false, color: '#ff2d78', params: [{ name: 'Mix', key: 'wet', min: 0, max: 1, value: 0.3, unit: '' }] },
  { id: 'flanger', name: 'FLANGER', active: false, color: '#39ff14', params: [{ name: 'Velocità', key: 'rate', min: 0.1, max: 5, value: 0.5, unit: 'Hz' }, { name: 'Profondità', key: 'depth', min: 0, max: 1, value: 0.5, unit: '' }] },
  { id: 'bitcrush', name: 'BITCRUSH', active: false, color: '#ffa500', params: [{ name: 'Bit Depth', key: 'bits', min: 1, max: 16, value: 8, unit: 'bit' }] },
];

export default function EffectsPanel({ engine }: EffectsPanelProps) {
  const [effects, setEffects] = useState<Effect[]>(INITIAL_EFFECTS);
  const [expandedEffect, setExpandedEffect] = useState<string | null>(null);

  const getParams = (effect: Effect): Record<string, number> =>
    Object.fromEntries(effect.params.map(p => [p.key, p.value]));

  const toggleEffect = useCallback((id: string) => {
    setEffects(prev => {
      const next = prev.map(e => e.id === id ? { ...e, active: !e.active } : e);
      const updated = next.find(e => e.id === id)!;
      engine.applyEffect(id, updated.active, getParams(updated));
      return next;
    });
  }, [engine]);

  const updateParam = useCallback((effectId: string, paramKey: string, value: number) => {
    setEffects(prev => {
      const next = prev.map(e => e.id !== effectId ? e : { ...e, params: e.params.map(p => p.key === paramKey ? { ...p, value } : p) });
      const updated = next.find(e => e.id === effectId)!;
      engine.applyEffect(effectId, updated.active, getParams(updated));
      return next;
    });
  }, [engine]);

  return (
    <div className="neon-border rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)' }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-purple-900/30 flex-wrap">
        <span className="text-[10px] tracking-[0.3em] text-purple-500 font-semibold flex-shrink-0">FX RACK</span>
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {effects.map(effect => (
            <div key={effect.id} className="flex items-stretch rounded overflow-hidden" style={{ border: `1px solid ${effect.active ? effect.color + '55' : 'rgba(255,255,255,0.08)'}` }}>
              {/* Toggle button */}
              <button
                onClick={() => toggleEffect(effect.id)}
                className="px-3 py-1 text-[10px] font-bold tracking-widest transition-all"
                style={effect.active
                  ? { background: `${effect.color}22`, color: effect.color, boxShadow: `0 0 8px ${effect.color}33` }
                  : { background: 'rgba(255,255,255,0.03)', color: '#6b7280' }}
                title={effect.active ? `Disattiva ${effect.name}` : `Attiva ${effect.name}`}
              >
                {effect.active ? '●' : '○'} {effect.name}
              </button>
              {/* Expand params button */}
              <button
                onClick={() => setExpandedEffect(expandedEffect === effect.id ? null : effect.id)}
                className="px-2 py-1 text-[10px] transition-all border-l"
                style={{
                  borderLeftColor: effect.active ? `${effect.color}33` : 'rgba(255,255,255,0.06)',
                  background: expandedEffect === effect.id ? `${effect.color}22` : 'transparent',
                  color: effect.active ? effect.color : '#4b5563',
                }}
                title="Parametri"
              >
                {expandedEffect === effect.id ? '▲' : '▼'}
              </button>
            </div>
          ))}
        </div>
      </div>
      {expandedEffect && (() => {
        const effect = effects.find(e => e.id === expandedEffect);
        if (!effect) return null;
        return (
          <div className="px-4 py-3 flex gap-6 items-center flex-wrap" style={{ borderTop: `1px solid ${effect.color}22` }}>
            <span className="text-[10px] font-bold tracking-widest" style={{ color: effect.color }}>{effect.name} PARAMS</span>
            {effect.params.map(param => (
              <div key={param.key} className="flex items-center gap-2">
                <span className="text-[9px] text-gray-500 w-18">{param.name}</span>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={(param.max - param.min) / 200}
                  value={param.value}
                  onChange={e => updateParam(effect.id, param.key, parseFloat(e.target.value))}
                  className="slider-neon w-24"
                />
                <span className="text-[10px] font-mono w-16 text-right" style={{ color: effect.color }}>
                  {param.value < 10 ? param.value.toFixed(2) : Math.round(param.value)}{param.unit}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
