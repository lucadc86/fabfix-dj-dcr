import { useState, useEffect, useRef, useCallback } from 'react';
import Logo from './components/Logo';
import Deck from './components/Deck';
import Mixer from './components/Mixer';
import Library from './components/Library';
import EffectsPanel from './components/EffectsPanel';
import AutomixPanel from './components/AutomixPanel';
import type { Track, DeckState, MixerState } from './types';
import { createAudioEngine } from './audio/engine';

export default function App() {
  const engineRef = useRef(createAudioEngine());
  const [deckA, setDeckA] = useState<DeckState>({ id: 'A', track: null, isPlaying: false, volume: 0.8, pitch: 0, bpm: 0, detectedBpm: 0, cuePoint: 0, currentTime: 0, duration: 0, loop: false, loopStart: 0, loopEnd: 0, eq: { low: 0, mid: 0, high: 0 }, gain: 0.8 });
  const [deckB, setDeckB] = useState<DeckState>({ id: 'B', track: null, isPlaying: false, volume: 0.8, pitch: 0, bpm: 0, detectedBpm: 0, cuePoint: 0, currentTime: 0, duration: 0, loop: false, loopStart: 0, loopEnd: 0, eq: { low: 0, mid: 0, high: 0 }, gain: 0.8 });
  const [mixer, setMixer] = useState<MixerState>({ crossfader: 0.5, masterVolume: 0.9 });
  const [library, setLibrary] = useState<Track[]>([]);
  const [automixActive, setAutomixActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'youtube'>('library');
  const engine = engineRef.current;

  const loadTrack = useCallback((deckId: 'A' | 'B', track: Track) => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => ({ ...prev, track, isPlaying: false, currentTime: 0, bpm: track.bpm || 0, detectedBpm: track.bpm || 0 }));
    engine.loadTrack(deckId, track);
  }, [engine]);

  const togglePlay = useCallback((deckId: 'A' | 'B') => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => {
      const newPlaying = !prev.isPlaying;
      if (newPlaying) engine.play(deckId); else engine.pause(deckId);
      return { ...prev, isPlaying: newPlaying };
    });
  }, [engine]);

  const setCue = useCallback((deckId: 'A' | 'B') => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => { engine.setCue(deckId, prev.currentTime); return { ...prev, cuePoint: prev.currentTime }; });
  }, [engine]);

  const jumpToCue = useCallback((deckId: 'A' | 'B') => {
    const deckState = deckId === 'A' ? deckA : deckB;
    engine.seekTo(deckId, deckState.cuePoint);
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => ({ ...prev, currentTime: prev.cuePoint }));
  }, [engine, deckA, deckB]);

  const syncDecks = useCallback((targetId: 'A' | 'B') => {
    const sourceId = targetId === 'A' ? 'B' : 'A';
    const sourceBpm = sourceId === 'A' ? deckA.detectedBpm : deckB.detectedBpm;
    const targetBpm = targetId === 'A' ? deckA.detectedBpm : deckB.detectedBpm;
    if (sourceBpm > 0 && targetBpm > 0) {
      const pitchAdjust = ((sourceBpm - targetBpm) / targetBpm) * 100;
      const setter = targetId === 'A' ? setDeckA : setDeckB;
      setter(prev => ({ ...prev, pitch: pitchAdjust }));
      engine.setPitch(targetId, pitchAdjust);
    }
  }, [engine, deckA, deckB]);

  const setVolume = useCallback((deckId: 'A' | 'B', volume: number) => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => ({ ...prev, volume }));
    engine.setVolume(deckId, volume);
  }, [engine]);

  const setGain = useCallback((deckId: 'A' | 'B', gain: number) => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => ({ ...prev, gain }));
    engine.setGain(deckId, gain);
  }, [engine]);

  const setPitch = useCallback((deckId: 'A' | 'B', pitch: number) => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => ({ ...prev, pitch }));
    engine.setPitch(deckId, pitch);
  }, [engine]);

  const setEq = useCallback((deckId: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => ({ ...prev, eq: { ...prev.eq, [band]: value } }));
    engine.setEq(deckId, band, value);
  }, [engine]);

  const setCrossfader = useCallback((value: number) => {
    setMixer(prev => ({ ...prev, crossfader: value }));
    engine.setCrossfader(value);
  }, [engine]);

  const setMasterVolume = useCallback((value: number) => {
    setMixer(prev => ({ ...prev, masterVolume: value }));
    engine.setMasterVolume(value);
  }, [engine]);

  const addTracksToLibrary = useCallback((tracks: Track[]) => {
    setLibrary(prev => [...prev, ...tracks]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDeckA(prev => ({ ...prev, currentTime: engine.getCurrentTime('A'), duration: engine.getDuration('A') }));
      setDeckB(prev => ({ ...prev, currentTime: engine.getCurrentTime('B'), duration: engine.getDuration('B') }));
    }, 100);
    return () => clearInterval(interval);
  }, [engine]);

  useEffect(() => {
    if (!automixActive) return;
    const interval = setInterval(() => {
      const fadeThreshold = 15;
      if (deckA.isPlaying && deckA.duration > 0 && deckA.duration - deckA.currentTime < fadeThreshold) {
        if (deckB.track && !deckB.isPlaying) { engine.play('B'); setDeckB(prev => ({ ...prev, isPlaying: true })); }
        const remaining = deckA.duration - deckA.currentTime;
        const prog = 1 - (remaining / fadeThreshold);
        const newCf = Math.min(1, 0.5 + prog * 0.5);
        setMixer(prev => ({ ...prev, crossfader: newCf }));
        engine.setCrossfader(newCf);
        if (remaining < 1) { engine.pause('A'); setDeckA(prev => ({ ...prev, isPlaying: false })); }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [automixActive, deckA, deckB, engine]);

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-purple-900/30" style={{ background: 'linear-gradient(180deg, #0a0014 0%, #050508 100%)' }}>
        <Logo />
        <div className="flex items-center gap-4">
          <AutomixPanel active={automixActive} onToggle={() => setAutomixActive(!automixActive)} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-400 font-mono">MASTER</span>
            <input type="range" min="0" max="1" step="0.01" value={mixer.masterVolume} onChange={e => setMasterVolume(parseFloat(e.target.value))} className="slider-neon w-24" />
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        <div className="flex gap-2 p-3" style={{ minHeight: '420px' }}>
          <div className="flex-1"><Deck deckState={deckA} side="left" onPlay={() => togglePlay('A')} onCue={() => jumpToCue('A')} onSetCue={() => setCue('A')} onSync={() => syncDecks('A')} onVolume={v => setVolume('A', v)} onGain={g => setGain('A', g)} onPitch={p => setPitch('A', p)} onEq={(band, v) => setEq('A', band, v)} /></div>
          <div className="w-52 flex-shrink-0"><Mixer mixer={mixer} deckA={deckA} deckB={deckB} onCrossfader={setCrossfader} /></div>
          <div className="flex-1"><Deck deckState={deckB} side="right" onPlay={() => togglePlay('B')} onCue={() => jumpToCue('B')} onSetCue={() => setCue('B')} onSync={() => syncDecks('B')} onVolume={v => setVolume('B', v)} onGain={g => setGain('B', g)} onPitch={p => setPitch('B', p)} onEq={(band, v) => setEq('B', band, v)} /></div>
        </div>
        <div className="px-3 pb-2"><EffectsPanel engine={engine} /></div>
        <div className="flex-1 px-3 pb-3">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setActiveTab('library')} className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${activeTab === 'library' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50 border-b-transparent' : 'text-gray-500 hover:text-purple-400'}`}>📁 LIBRARY</button>
            <button onClick={() => setActiveTab('youtube')} className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${activeTab === 'youtube' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50 border-b-transparent' : 'text-gray-500 hover:text-purple-400'}`}>▶ YOUTUBE</button>
          </div>
          <Library tracks={library} onAddTracks={addTracksToLibrary} onLoadToDeck={loadTrack} activeTab={activeTab} deckATrack={deckA.track} deckBTrack={deckB.track} />
        </div>
      </main>
    </div>
  );
}
