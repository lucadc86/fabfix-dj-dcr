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
      const arr = JSON.parse(stored) as Array<{ id: string; youtubeId: string; title: string; bpm?: number }>;
      return arr.map(t => ({ id: t.id, title: t.title, artist: 'YouTube', duration: 0, bpm: t.bpm ?? 0, youtubeId: t.youtubeId, color: '#ff2d78' }));
    }
  } catch { /* ignore */ }
  return [];
}

const MIN_PITCH_ADJUST = -12;
const MAX_PITCH_ADJUST = 12;

export default function App() {
  const [engine] = useState(() => createAudioEngine());
  const [deckA, setDeckA] = useState<DeckState>({ id: 'A', track: null, isPlaying: false, volume: 0.8, pitch: 0, bpm: 0, detectedBpm: 0, cuePoint: 0, currentTime: 0, duration: 0, loop: false, loopStart: 0, loopEnd: 0, eq: { low: 0, mid: 0, high: 0 }, gain: 0.8 });
  const [deckB, setDeckB] = useState<DeckState>({ id: 'B', track: null, isPlaying: false, volume: 0.8, pitch: 0, bpm: 0, detectedBpm: 0, cuePoint: 0, currentTime: 0, duration: 0, loop: false, loopStart: 0, loopEnd: 0, eq: { low: 0, mid: 0, high: 0 }, gain: 0.8 });
  const [mixer, setMixer] = useState<MixerState>({ crossfader: 0.5, masterVolume: 0.9 });
  const [library, setLibrary] = useState<Track[]>(loadYtLibraryFromStorage);
  const [automixActive, setAutomixActive] = useState(false);
  const [automixFadeTime, setAutomixFadeTime] = useState(15);
  const [automixBpmSync, setAutomixBpmSync] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'youtube'>('library');

  // Volume refs for crossfader-aware YouTube volume updates
  const deckAVolumeRef = useRef(0.8);
  const deckBVolumeRef = useRef(0.8);
  const crossfaderRef = useRef(0.5);
  // Tracks whether BPM-sync pitch was already applied for the current automix transition
  const bpmSyncAppliedRef = useRef<{ A: boolean; B: boolean }>({ A: false, B: false });

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
    const players: { A: YTPlayerInstance | null; B: YTPlayerInstance | null } = { A: null, B: null };
    loadYouTubeAPI(() => {
      (['A', 'B'] as const).forEach(deckId => {
        const setter = deckId === 'A' ? setDeckA : setDeckB;
        const player = new window.YT.Player(`yt-deck-${deckId}`, {
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
        ytPlayersRef.current[deckId] = player;
        players[deckId] = player;
      });
    });
    return () => {
      players.A?.destroy();
      players.B?.destroy();
    };
  }, []);

  // Persist YouTube tracks (including BPM) to localStorage whenever the library changes
  useEffect(() => {
    const ytTracks = library
      .filter(t => !!t.youtubeId)
      .map(t => ({ id: t.id, youtubeId: t.youtubeId!, title: t.title, bpm: t.bpm }));
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
    // Preserve existing BPM from library if already set
    const existingTrack = library.find(t => t.id === trackId);
    const bpm = existingTrack?.bpm ?? 0;
    const track: Track = { id: trackId, title, artist: 'YouTube', duration: 0, bpm, youtubeId, color: '#ff2d78' };

    // Add to global library if not already present
    setLibrary(prev => prev.some(t => t.id === trackId) ? prev : [...prev, track]);

    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => {
      // Stop audio engine if it was playing an audio track
      if (prev.track && !prev.track.youtubeId && prev.isPlaying) engine.pause(deckId);
      return { ...prev, track, isPlaying: false, currentTime: 0, bpm, detectedBpm: bpm, duration: 0 };
    });

    // Load (but don't play) the video in the deck's YouTube player
    const player = ytPlayersRef.current[deckId];
    if (player) {
      try { player.cueVideoById(youtubeId); } catch { ytPendingRef.current[deckId] = youtubeId; }
    } else {
      ytPendingRef.current[deckId] = youtubeId;
    }
  }, [engine, library]);

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

  const updateYouTubeTrackBpm = useCallback((youtubeId: string, bpm: number) => {
    setLibrary(prev => prev.map(t => t.youtubeId === youtubeId ? { ...t, bpm } : t));
    // Also update the deck state if this track is currently loaded
    setDeckA(prev => prev.track?.youtubeId === youtubeId ? { ...prev, bpm, detectedBpm: bpm } : prev);
    setDeckB(prev => prev.track?.youtubeId === youtubeId ? { ...prev, bpm, detectedBpm: bpm } : prev);
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

  const setDeckLoop = useCallback((deckId: 'A' | 'B', active: boolean, start?: number, end?: number) => {
    const setter = deckId === 'A' ? setDeckA : setDeckB;
    setter(prev => {
      const newStart = start !== undefined ? start : prev.loopStart;
      const newEnd = end !== undefined ? end : prev.loopEnd;
      return { ...prev, loop: active, loopStart: newStart, loopEnd: newEnd };
    });
    engine.setLoopActive(deckId, active, start, end);
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
      const fadeThreshold = automixFadeTime;

      const doTransition = (fromId: 'A' | 'B', toId: 'A' | 'B') => {
        const from = fromId === 'A' ? deckA : deckB;
        const to = toId === 'A' ? deckA : deckB;
        const setFrom = fromId === 'A' ? setDeckA : setDeckB;
        const setTo = toId === 'A' ? setDeckA : setDeckB;

        if (!from.isPlaying || from.duration <= 0) return;
        const remaining = from.duration - from.currentTime;
        if (remaining >= fadeThreshold) return;

        // Start the target deck if it has a track and isn't playing
        if (to.track && !to.isPlaying) {
          // Apply BPM sync pitch once when starting the incoming deck
          if (automixBpmSync && from.detectedBpm > 0 && to.detectedBpm > 0 && !bpmSyncAppliedRef.current[toId]) {
            const rawPitch = ((from.detectedBpm - to.detectedBpm) / to.detectedBpm) * 100;
            const pitchAdjust = Math.max(MIN_PITCH_ADJUST, Math.min(MAX_PITCH_ADJUST, rawPitch));
            setTo(prev => ({ ...prev, pitch: pitchAdjust }));
            engine.setPitch(toId, pitchAdjust);
            bpmSyncAppliedRef.current[toId] = true;
          }
          if (to.track.youtubeId) {
            ytPlayersRef.current[toId]?.playVideo();
          } else {
            engine.play(toId);
          }
          setTo(prev => ({ ...prev, isPlaying: true }));
        }

        const prog = Math.max(0, Math.min(1, 1 - remaining / fadeThreshold));
        // fromId=A: crossfader moves from 0.5 toward 1 (full B)
        // fromId=B: crossfader moves from 0.5 toward 0 (full A)
        const newCf = fromId === 'A'
          ? Math.min(1, 0.5 + prog * 0.5)
          : Math.max(0, 0.5 - prog * 0.5);
        crossfaderRef.current = newCf;
        setMixer(prev => ({ ...prev, crossfader: newCf }));
        engine.setCrossfader(newCf);
        applyYtCrossfaderVolumes(newCf);

        if (remaining < 0.5) {
          if (from.track?.youtubeId) {
            ytPlayersRef.current[fromId]?.pauseVideo();
          } else {
            engine.pause(fromId);
          }
          setFrom(prev => ({ ...prev, isPlaying: false }));
          if (!from.track?.youtubeId) engine.seekTo(fromId, 0);
          bpmSyncAppliedRef.current[fromId] = false;
          // Reset crossfader to center after a short delay
          setTimeout(() => {
            crossfaderRef.current = 0.5;
            setMixer(prev => ({ ...prev, crossfader: 0.5 }));
            engine.setCrossfader(0.5);
            applyYtCrossfaderVolumes(0.5);
          }, 1500);
        }
      };

      if (deckA.isPlaying) doTransition('A', 'B');
      else if (deckB.isPlaying) doTransition('B', 'A');
    }, 300);
    return () => clearInterval(interval);
  }, [automixActive, automixFadeTime, automixBpmSync, deckA, deckB, engine, applyYtCrossfaderVolumes]);

  const ytTracks = library.filter(t => !!t.youtubeId);
  const localTracks = library.filter(t => !t.youtubeId);

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: '#050508' }}>
      <header className="flex flex-col border-b border-purple-900/30" style={{ background: 'linear-gradient(180deg, #0a0014 0%, #050508 100%)' }}>
        <div className="flex flex-col items-center pt-2 pb-0.5">
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: '#b44fff', letterSpacing: '0.3em' }}>DEVELOPED by DCR GROUP</span>
          <span className="text-[9px] tracking-[0.25em] text-purple-500 font-medium uppercase">for LUNI DI PASQUA EDITION</span>
        </div>
        <div className="flex items-center justify-between px-6 py-2">
          <Logo />
          <div className="flex items-center gap-4">
            <AutomixPanel
              active={automixActive}
              onToggle={() => setAutomixActive(!automixActive)}
              fadeTime={automixFadeTime}
              onFadeTimeChange={setAutomixFadeTime}
              bpmSync={automixBpmSync}
              onBpmSyncToggle={() => setAutomixBpmSync(v => !v)}
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-400 font-mono">MASTER</span>
                <input type="range" min="0" max="1" step="0.01" value={mixer.masterVolume} onChange={e => setMasterVolume(parseFloat(e.target.value))} className="slider-neon w-24" />
              </div>
              {/* REC button (decorative) */}
              <button
                onClick={() => setIsRecording(r => !r)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all"
                style={isRecording
                  ? { background: 'rgba(255,45,120,0.25)', border: '1px solid rgba(255,45,120,0.7)', color: '#ff2d78', boxShadow: '0 0 12px rgba(255,45,120,0.4)' }
                  : { background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.3)', color: '#ff2d78' }}
              >
                <span className={isRecording ? 'animate-pulse' : ''} style={{ fontSize: 8 }}>●</span>
                <span>REC</span>
              </button>
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
          <div className="flex-1"><Deck deckState={deckA} side="left" onPlay={() => togglePlay('A')} onCue={() => jumpToCue('A')} onSetCue={() => setCue('A')} onSync={() => syncDecks('A')} onVolume={v => setVolume('A', v)} onGain={g => setGain('A', g)} onPitch={p => setPitch('A', p)} onEq={(band, v) => setEq('A', band, v)} onScratch={d => handleScratch('A', d)} onDrumPad={id => engine.playDrumPad(id)} onLoop={(active, start, end) => setDeckLoop('A', active, start, end)} /></div>
          <div className="w-52 flex-shrink-0"><Mixer mixer={mixer} deckA={deckA} deckB={deckB} onCrossfader={setCrossfader} /></div>
          <div className="flex-1"><Deck deckState={deckB} side="right" onPlay={() => togglePlay('B')} onCue={() => jumpToCue('B')} onSetCue={() => setCue('B')} onSync={() => syncDecks('B')} onVolume={v => setVolume('B', v)} onGain={g => setGain('B', g)} onPitch={p => setPitch('B', p)} onEq={(band, v) => setEq('B', band, v)} onScratch={d => handleScratch('B', d)} onDrumPad={id => engine.playDrumPad(id)} onLoop={(active, start, end) => setDeckLoop('B', active, start, end)} /></div>
        </div>
        <div className="px-3 pb-2"><EffectsPanel engine={engine} /></div>
        <div className="flex-1 px-3 pb-3">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setActiveTab('library')} className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${activeTab === 'library' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50 border-b-transparent' : 'text-gray-500 hover:text-purple-400'}`}>📁 LIBRERIA</button>
            <button onClick={() => setActiveTab('youtube')} className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${activeTab === 'youtube' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50 border-b-transparent' : 'text-gray-500 hover:text-purple-400'}`}>▶ YOUTUBE</button>
          </div>
          {activeTab === 'library' ? (
            <Library
              tracks={localTracks}
              onAddTracks={addTracksToLibrary}
              onLoadToDeck={loadTrack}
              onRemoveTrack={removeFromLibrary}
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
              onUpdateTrackBpm={updateYouTubeTrackBpm}
            />
          )}
        </div>
      </main>
    </div>
  );
}
