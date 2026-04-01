import { useState, useEffect, useRef, useCallback } from 'react';
import Logo from './components/Logo';
import Deck from './components/Deck';
import Mixer from './components/Mixer';
import Library from './components/Library';
import EffectsPanel from './components/EffectsPanel';
import AutomixPanel from './components/AutomixPanel';
import YouTubePanel from './components/YouTubePanel';
import type { Track, DeckState, MixerState, YTPlayerInstance } from './types';
import { createAudioEngine } from './audio/engine';
import { loadYouTubeAPI } from './audio/youtube';

const YT_LIBRARY_KEY = 'yt-library';

function loadYtLibraryFromStorage(): Track[] {
  try {
    const stored = localStorage.getItem(YT_LIBRARY_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as Array<{ id: string; youtubeId: string; title: string }>;
      return arr.map(t => ({ id: t.id, title: t.title, artist: 'YouTube', duration: 0, bpm: 0, youtubeId: t.youtubeId, color: '#ff2d78' }));
    }
  } catch { /* ignore */ }
  return [];
}

export default function App() {
  const engineRef = useRef(createAudioEngine());
  const [deckA, setDeckA] = useState<DeckState>({ id: 'A', track: null, isPlaying: false, volume: 0.8, pitch: 0, bpm: 0, detectedBpm: 0, cuePoint: 0, currentTime: 0, duration: 0, loop: false, loopStart: 0, loopEnd: 0, eq: { low: 0, mid: 0, high: 0 }, gain: 0.8 });
  const [deckB, setDeckB] = useState<DeckState>({ id: 'B', track: null, isPlaying: false, volume: 0.8, pitch: 0, bpm: 0, detectedBpm: 0, cuePoint: 0, currentTime: 0, duration: 0, loop: false, loopStart: 0, loopEnd: 0, eq: { low: 0, mid: 0, high: 0 }, gain: 0.8 });
  const [mixer, setMixer] = useState<MixerState>({ crossfader: 0.5, masterVolume: 0.9 });
  const [library, setLibrary] = useState<Track[]>(loadYtLibraryFromStorage);
  const [automixActive, setAutomixActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'youtube'>('library');
  const engine = engineRef.current;

  // Volume refs for crossfader-aware YouTube volume updates
  const deckAVolumeRef = useRef(0.8);
  const deckBVolumeRef = useRef(0.8);
  const crossfaderRef = useRef(0.5);

  // Per-deck YouTube IFrame players (hidden, audio-only output)
  const ytPlayersRef = useRef<{ A: YTPlayerInstance | null; B: YTPlayerInstance | null }>({ A: null, B: null });
  const ytPendingRef = useRef<{ A: string | null; B: string | null }>({ A: null, B: null });

  const applyYtCrossfaderVolumes = useCallback((cf: number) => {
    const angle = cf * (Math.PI / 2);
    const gainA = Math.cos(angle);
    const gainB = Math.sin(angle);
    ytPlayersRef.current.A?.setVolume(gainA * deckAVolumeRef.current * 100);
    ytPlayersRef.current.B?.setVolume(gainB * deckBVolumeRef.current * 100);
  }, []);

  // Load YouTube IFrame API once and create a hidden player for each deck
  useEffect(() => {
    loadYouTubeAPI(() => {
      (['A', 'B'] as const).forEach(deckId => {
        const setter = deckId === 'A' ? setDeckA : setDeckB;
        ytPlayersRef.current[deckId] = new window.YT.Player(`yt-deck-${deckId}`, {
          height: '2',
          width: '2',
          playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              const pending = ytPendingRef.current[deckId];
              if (pending) {
                ytPlayersRef.current[deckId]?.cueVideoById(pending);
                ytPendingRef.current[deckId] = null;
              }
            },
            onStateChange: (e) => {
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (e.data === 1) setter(prev => ({ ...prev, isPlaying: true }));
              else if (e.data === 2 || e.data === 0) setter(prev => ({ ...prev, isPlaying: false }));
            },
          },
        });
      });
    });
    return () => {
      const playerA = ytPlayersRef.current.A;
      const playerB = ytPlayersRef.current.B;
      playerA?.destroy();
      playerB?.destroy();
    };
  }, []);

  // Persist YouTube tracks to localStorage whenever the library changes
  useEffect(() => {
    const ytTracks = library
      .filter(t => !!t.youtubeId)
      .map(t => ({ id: t.id, youtubeId: t.youtubeId!, title: t.title }));
    localStorage.setItem(YT_LIBRARY_KEY, JSON.stringify(ytTracks));
  }, [library]);

  const loadTrack = useCallback((deckId: 'A' | 'B', track: Track) => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => {
      // Pause the YouTube player if the deck was playing a YouTube track
      if (prev.track?.youtubeId) ytPlayersRef.current[deckId]?.pauseVideo();
      const bpm = track.bpm || 0;
      return { ...prev, track, isPlaying: false, currentTime: 0, bpm, detectedBpm: bpm };
    });
    engine.loadTrack(deckId, track);
  }, [engine]);

  const loadYouTubeToDeck = useCallback((deckId: 'A' | 'B', youtubeId: string, title: string) => {
    const trackId = `yt-${youtubeId}`;
    const track: Track = { id: trackId, title, artist: 'YouTube', duration: 0, bpm: 0, youtubeId, color: '#ff2d78' };

    // Add to global library if not already present
    setLibrary(prev => prev.some(t => t.id === trackId) ? prev : [...prev, track]);

    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => {
      // Stop audio engine if it was playing an audio track
      if (prev.track && !prev.track.youtubeId && prev.isPlaying) engine.pause(deckId);
      return { ...prev, track, isPlaying: false, currentTime: 0, bpm: 0, detectedBpm: 0, duration: 0 };
    });

    // Load (but don't play) the video in the deck's YouTube player
    const player = ytPlayersRef.current[deckId];
    if (player) {
      try { player.cueVideoById(youtubeId); } catch { ytPendingRef.current[deckId] = youtubeId; }
    } else {
      ytPendingRef.current[deckId] = youtubeId;
    }
  }, [engine]);

  const addYouTubeToLibrary = useCallback((youtubeId: string, title: string) => {
    const trackId = `yt-${youtubeId}`;
    const track: Track = { id: trackId, title, artist: 'YouTube', duration: 0, bpm: 0, youtubeId, color: '#ff2d78' };
    setLibrary(prev => prev.some(t => t.id === trackId) ? prev : [...prev, track]);
  }, []);

  const removeFromLibrary = useCallback((trackId: string) => {
    setLibrary(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const updateYouTubeTrackTitle = useCallback((youtubeId: string, title: string) => {
    setLibrary(prev => prev.map(t => t.youtubeId === youtubeId ? { ...t, title } : t));
  }, []);

  const togglePlay = useCallback((deckId: 'A' | 'B') => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => {
      const newPlaying = !prev.isPlaying;
      if (prev.track?.youtubeId) {
        // Route play/pause to the deck's YouTube IFrame player
        const player = ytPlayersRef.current[deckId];
        if (player) { if (newPlaying) player.playVideo(); else player.pauseVideo(); }
      } else {
        if (newPlaying) engine.play(deckId); else engine.pause(deckId);
      }
      return { ...prev, isPlaying: newPlaying };
    });
  }, [engine]);

  const setCue = useCallback((deckId: 'A' | 'B') => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => { engine.setCue(deckId, prev.currentTime); return { ...prev, cuePoint: prev.currentTime }; });
  }, [engine]);

  const jumpToCue = useCallback((deckId: 'A' | 'B') => {
    const deckState = deckId === 'A' ? deckA : deckB;
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    if (deckState.track?.youtubeId) {
      ytPlayersRef.current[deckId]?.seekTo(deckState.cuePoint, true);
      setter(prev => ({ ...prev, currentTime: prev.cuePoint }));
    } else {
      engine.seekTo(deckId, deckState.cuePoint);
      setter(prev => ({ ...prev, currentTime: prev.cuePoint }));
    }
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
    if (deckId === 'A') deckAVolumeRef.current = volume;
    else deckBVolumeRef.current = volume;
    setter(prev => {
      if (prev.track?.youtubeId) {
        const angle = crossfaderRef.current * (Math.PI / 2);
        const cfGain = deckId === 'A' ? Math.cos(angle) : Math.sin(angle);
        ytPlayersRef.current[deckId]?.setVolume(volume * cfGain * 100);
      } else {
        engine.setVolume(deckId, volume);
      }
      return { ...prev, volume };
    });
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
    crossfaderRef.current = value;
    setMixer(prev => ({ ...prev, crossfader: value }));
    engine.setCrossfader(value);
    // Apply crossfader to YouTube players
    applyYtCrossfaderVolumes(value);
  }, [engine, applyYtCrossfaderVolumes]);

  const setMasterVolume = useCallback((value: number) => {
    setMixer(prev => ({ ...prev, masterVolume: value }));
    engine.setMasterVolume(value);
  }, [engine]);

  const addTracksToLibrary = useCallback((tracks: Track[]) => {
    setLibrary(prev => [...prev, ...tracks]);
  }, []);

  const handleScratch = useCallback((deckId: 'A' | 'B', deltaSeconds: number) => {
    const deckState = deckId === 'A' ? deckA : deckB;
    if (deckState.track?.youtubeId) {
      const newTime = Math.max(0, (deckState.currentTime || 0) + deltaSeconds);
      ytPlayersRef.current[deckId]?.seekTo(newTime, true);
    } else {
      const newTime = Math.max(0, (engine.getCurrentTime(deckId) || 0) + deltaSeconds);
      engine.seekTo(deckId, newTime);
    }
  }, [engine, deckA, deckB]);

  // Polling loop: update currentTime/duration from audio engine or YouTube player
  useEffect(() => {
    const interval = setInterval(() => {
      setDeckA(prev => {
        if (prev.track?.youtubeId) {
          const player = ytPlayersRef.current.A;
          if (!player) return prev;
          try {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            if (currentTime === prev.currentTime && duration === prev.duration) return prev;
            return { ...prev, currentTime, duration };
          } catch { return prev; }
        }
        return { ...prev, currentTime: engine.getCurrentTime('A'), duration: engine.getDuration('A') };
      });
      setDeckB(prev => {
        if (prev.track?.youtubeId) {
          const player = ytPlayersRef.current.B;
          if (!player) return prev;
          try {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            if (currentTime === prev.currentTime && duration === prev.duration) return prev;
            return { ...prev, currentTime, duration };
          } catch { return prev; }
        }
        return { ...prev, currentTime: engine.getCurrentTime('B'), duration: engine.getDuration('B') };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [engine]);

  useEffect(() => {
    if (!automixActive) return;
    const interval = setInterval(() => {
      const fadeThreshold = 15;
      if (deckA.isPlaying && deckA.duration > 0 && deckA.duration - deckA.currentTime < fadeThreshold) {
        if (deckB.track && !deckB.isPlaying) {
          if (deckB.track.youtubeId) {
            ytPlayersRef.current.B?.playVideo();
          } else {
            engine.play('B');
          }
          setDeckB(prev => ({ ...prev, isPlaying: true }));
        }
        const remaining = deckA.duration - deckA.currentTime;
        const prog = 1 - (remaining / fadeThreshold);
        const newCf = Math.min(1, 0.5 + prog * 0.5);
        crossfaderRef.current = newCf;
        setMixer(prev => ({ ...prev, crossfader: newCf }));
        engine.setCrossfader(newCf);
        applyYtCrossfaderVolumes(newCf);
        if (remaining < 1) {
          if (deckA.track?.youtubeId) {
            ytPlayersRef.current.A?.pauseVideo();
          } else {
            engine.pause('A');
          }
          setDeckA(prev => ({ ...prev, isPlaying: false }));
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [automixActive, deckA, deckB, engine, applyYtCrossfaderVolumes]);

  const ytTracks = library.filter(t => !!t.youtubeId);

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <header className="flex flex-col border-b border-purple-900/30" style={{ background: 'linear-gradient(180deg, #0a0014 0%, #050508 100%)' }}>
        <div className="flex flex-col items-center pt-2 pb-0.5">
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: '#b44fff', letterSpacing: '0.3em' }}>DEVELOPED by DCR GROUP</span>
          <span className="text-[9px] tracking-[0.25em] text-purple-500 font-medium uppercase">for LUNI DI PASQUA EDITION</span>
        </div>
        <div className="flex items-center justify-between px-6 py-2">
          <Logo />
          <div className="flex items-center gap-4">
            <AutomixPanel active={automixActive} onToggle={() => setAutomixActive(!automixActive)} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-400 font-mono">MASTER</span>
              <input type="range" min="0" max="1" step="0.01" value={mixer.masterVolume} onChange={e => setMasterVolume(parseFloat(e.target.value))} className="slider-neon w-24" />
            </div>
          </div>
        </div>
      </header>

      {/* Hidden per-deck YouTube players – produce audio without visible video */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: 2, height: 4, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <div id="yt-deck-A" />
        <div id="yt-deck-B" />
      </div>

      <main className="flex-1 flex flex-col">
        <div className="flex gap-2 p-3" style={{ minHeight: '420px' }}>
          <div className="flex-1"><Deck deckState={deckA} side="left" onPlay={() => togglePlay('A')} onCue={() => jumpToCue('A')} onSetCue={() => setCue('A')} onSync={() => syncDecks('A')} onVolume={v => setVolume('A', v)} onGain={g => setGain('A', g)} onPitch={p => setPitch('A', p)} onEq={(band, v) => setEq('A', band, v)} onScratch={d => handleScratch('A', d)} /></div>
          <div className="w-52 flex-shrink-0"><Mixer mixer={mixer} deckA={deckA} deckB={deckB} onCrossfader={setCrossfader} /></div>
          <div className="flex-1"><Deck deckState={deckB} side="right" onPlay={() => togglePlay('B')} onCue={() => jumpToCue('B')} onSetCue={() => setCue('B')} onSync={() => syncDecks('B')} onVolume={v => setVolume('B', v)} onGain={g => setGain('B', g)} onPitch={p => setPitch('B', p)} onEq={(band, v) => setEq('B', band, v)} onScratch={d => handleScratch('B', d)} /></div>
        </div>
        <div className="px-3 pb-2"><EffectsPanel engine={engine} /></div>
        <div className="flex-1 px-3 pb-3">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setActiveTab('library')} className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${activeTab === 'library' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50 border-b-transparent' : 'text-gray-500 hover:text-purple-400'}`}>📁 LIBRERIA</button>
            <button onClick={() => setActiveTab('youtube')} className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${activeTab === 'youtube' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50 border-b-transparent' : 'text-gray-500 hover:text-purple-400'}`}>▶ YOUTUBE</button>
          </div>
          {activeTab === 'library' ? (
            <Library
              tracks={library.filter(t => !t.youtubeId)}
              onAddTracks={addTracksToLibrary}
              onLoadToDeck={loadTrack}
              deckATrack={deckA.track}
              deckBTrack={deckB.track}
            />
          ) : (
            <YouTubePanel
              tracks={ytTracks}
              onAddTrack={addYouTubeToLibrary}
              onRemoveTrack={removeFromLibrary}
              onLoadToDeck={loadYouTubeToDeck}
              onUpdateTrackTitle={updateYouTubeTrackTitle}
            />
          )}
        </div>
      </main>
    </div>
  );
}
