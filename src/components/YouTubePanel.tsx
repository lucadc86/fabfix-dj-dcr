import { useState, useEffect, useRef, useCallback } from 'react';
import type { Track } from '../types';
import { loadYouTubeAPI } from '../audio/youtube';

interface YouTubePanelProps {
  tracks: Track[];
  onAddTrack: (youtubeId: string, title: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onLoadToDeck: (deckId: 'A' | 'B', youtubeId: string, title: string) => void;
  onUpdateTrackTitle: (youtubeId: string, title: string) => void;
  onUpdateTrackBpm: (youtubeId: string, bpm: number) => void;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) return match[1];
  }
  return null;
}

const TAP_RESET_TIMEOUT_MS = 3000;
const MS_PER_MINUTE = 60000;
const MIN_BPM = 40;
const MAX_BPM = 250;

export default function YouTubePanel({ tracks, onAddTrack, onRemoveTrack, onLoadToDeck, onUpdateTrackTitle, onUpdateTrackBpm }: YouTubePanelProps) {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYoutubeId, setSelectedYoutubeId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const playerRef = useRef<import('../types').YTPlayerInstance | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const playerDivId = 'yt-preview-player';

  // TAP BPM: maps youtubeId -> list of recent tap timestamps
  const tapTimesRef = useRef<Record<string, number[]>>({});
  // Manual BPM input state: maps youtubeId -> current input string
  const [bpmInputs, setBpmInputs] = useState<Record<string, string>>({});

  const selectedTrack = tracks.find(t => t.youtubeId === selectedYoutubeId) ?? null;

  const filteredTracks = searchQuery.trim()
    ? tracks.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.youtubeId ?? '').includes(searchQuery)
      )
    : tracks;

  useEffect(() => {
    loadYouTubeAPI(() => setApiReady(true));
  }, []);

  const applyTrackTitle = useCallback((youtubeId: string, title: string) => {
    onUpdateTrackTitle(youtubeId, title);
  }, [onUpdateTrackTitle]);

  const initPlayer = useCallback((videoId: string) => {
    if (!apiReady) return;
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      playerRef.current.playVideo();
      return;
    }
    playerRef.current = new window.YT.Player(playerDivId, {
      height: '120',
      width: '100%',
      videoId,
      playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e) => {
          e.target.playVideo();
          setIsPlaying(true);
          const data = e.target.getVideoData();
          if (data?.title) applyTrackTitle(videoId, data.title);
        },
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            if (playerRef.current) {
              const data = playerRef.current.getVideoData();
              if (data?.title && data?.video_id) applyTrackTitle(data.video_id, data.title);
            }
          }
          if (e.data === window.YT.PlayerState.PAUSED || e.data === window.YT.PlayerState.ENDED) setIsPlaying(false);
        },
      },
    });
  }, [apiReady, applyTrackTitle]);

  useEffect(() => {
    if (!selectedYoutubeId) { currentVideoIdRef.current = null; return; }
    if (!apiReady) return;
    if (currentVideoIdRef.current === selectedYoutubeId && playerRef.current) return;
    currentVideoIdRef.current = selectedYoutubeId;
    initPlayer(selectedYoutubeId);
  }, [selectedYoutubeId, apiReady, initPlayer]);

  const handleAdd = useCallback(() => {
    setError('');
    const videoId = extractVideoId(urlInput);
    if (!videoId) { setError('URL YouTube non valido. Incolla un link YouTube valido.'); return; }
    const alreadyExists = tracks.some(t => t.youtubeId === videoId);
    if (alreadyExists) { setError('Questo brano è già nella lista.'); return; }
    onAddTrack(videoId, `YouTube – ${videoId}`);
    setUrlInput('');
    setSelectedYoutubeId(videoId);
  }, [urlInput, tracks, onAddTrack]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    const state = playerRef.current.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) { playerRef.current.pauseVideo(); }
    else { playerRef.current.playVideo(); }
  }, []);

  // TAP BPM: record tap timestamps and compute average BPM from last 8 taps
  const handleTap = useCallback((youtubeId: string) => {
    const now = performance.now();
    const prev = tapTimesRef.current[youtubeId] ?? [];
    // Keep last 8 timestamps; reset if gap > TAP_RESET_TIMEOUT_MS
    const recent = prev.length > 0 && (now - prev[prev.length - 1]) > TAP_RESET_TIMEOUT_MS ? [now] : [...prev.slice(-7), now];
    tapTimesRef.current[youtubeId] = recent;
    if (recent.length < 2) return;
    const intervals: number[] = [];
    for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1]);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(MS_PER_MINUTE / avgMs);
    if (bpm >= MIN_BPM && bpm <= MAX_BPM) {
      onUpdateTrackBpm(youtubeId, bpm);
      setBpmInputs(prev => ({ ...prev, [youtubeId]: String(bpm) }));
    }
  }, [onUpdateTrackBpm]);

  const handleBpmInputChange = useCallback((youtubeId: string, value: string) => {
    setBpmInputs(prev => ({ ...prev, [youtubeId]: value }));
  }, []);

  const handleBpmInputCommit = useCallback((youtubeId: string) => {
    const raw = bpmInputs[youtubeId];
    if (raw === undefined) return;
    const bpm = parseInt(raw, 10);
    if (!isNaN(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM) {
      onUpdateTrackBpm(youtubeId, bpm);
    }
  }, [bpmInputs, onUpdateTrackBpm]);

  return (
    <div className="neon-border rounded-xl rounded-tl-none overflow-hidden h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)', minHeight: 120 }}>
      {/* URL Input bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-purple-900/30">
        <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">URL</span>
        <input
          type="text"
          value={urlInput}
          onChange={e => { setUrlInput(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Incolla link YouTube (es. https://youtu.be/...)"
          className="flex-1 bg-transparent text-xs text-white placeholder-gray-700 outline-none border border-purple-900/30 rounded px-2 py-1 focus:border-purple-600/60 transition-colors"
        />
        <button onClick={handleAdd} className="btn-neon px-3 py-1.5 rounded text-[10px] font-bold tracking-wider flex-shrink-0">+ AGGIUNGI</button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-purple-900/20">
        <span className="text-[10px] text-gray-600">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cerca brani YouTube..."
          className="flex-1 bg-transparent text-xs text-white placeholder-gray-700 outline-none"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-[10px] text-gray-600 hover:text-gray-400">✕</button>
        )}
      </div>

      {error && (
        <div className="px-4 py-1 text-[10px] text-red-400 border-b border-red-900/20">{error}</div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Track list */}
        <div className="w-48 flex-shrink-0 border-r border-purple-900/20 overflow-y-auto">
          {filteredTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-1 opacity-40 px-3">
              <span className="text-2xl">▶</span>
              <span className="text-[10px] text-gray-500 text-center">
                {tracks.length === 0 ? 'Nessun brano YouTube.\nIncolla un URL sopra.' : 'Nessun risultato.'}
              </span>
            </div>
          ) : (
            <div className="divide-y divide-purple-900/10">
              {filteredTracks.filter(t => !!t.youtubeId).map(track => {
                const isSelected = selectedYoutubeId === track.youtubeId;
                const ytId = track.youtubeId as string;
                const bpmDisplay = bpmInputs[ytId] !== undefined ? bpmInputs[ytId] : (track.bpm > 0 ? String(track.bpm) : '');
                return (
                  <div
                    key={track.id}
                    className={`px-3 py-2 cursor-pointer transition-all hover:bg-purple-900/10 ${isSelected ? 'bg-purple-900/20' : ''}`}
                    onClick={() => setSelectedYoutubeId(isSelected ? null : ytId)}
                  >
                    {/* Title row */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] text-red-400 font-bold flex-shrink-0">YT</span>
                      <span className="text-[10px] text-white truncate flex-1">{track.title}</span>
                    </div>

                    {/* BPM row — always visible */}
                    <div className="flex items-center gap-1 mb-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleTap(ytId)}
                        className="px-2 py-0.5 rounded text-[9px] font-bold transition-all flex-shrink-0"
                        style={{ background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.35)', color: '#ffa500' }}
                        title="Clicca a ritmo per rilevare BPM"
                      >TAP</button>
                      <input
                        type="number"
                        min={MIN_BPM}
                        max={MAX_BPM}
                        value={bpmDisplay}
                        onChange={e => handleBpmInputChange(ytId, e.target.value)}
                        onBlur={() => handleBpmInputCommit(ytId)}
                        onKeyDown={e => e.key === 'Enter' && handleBpmInputCommit(ytId)}
                        placeholder="BPM"
                        className="w-14 bg-transparent text-[9px] font-mono outline-none border border-purple-900/30 rounded px-1 py-0.5 focus:border-orange-600/60 transition-colors text-orange-300"
                        title="Imposta BPM manualmente"
                      />
                      <span className="text-[9px] text-gray-600 font-mono">BPM</span>
                    </div>

                    {/* Action buttons — always visible */}
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onLoadToDeck('A', ytId, track.title)}
                        className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
                        style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)', color: '#00f5ff' }}
                      >A</button>
                      <button
                        onClick={() => onLoadToDeck('B', ytId, track.title)}
                        className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
                        style={{ background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.25)', color: '#ff2d78' }}
                      >B</button>
                      <button
                        onClick={() => {
                          if (isSelected) {
                            playerRef.current?.stopVideo();
                            setSelectedYoutubeId(null);
                            setIsPlaying(false);
                          }
                          onRemoveTrack(track.id);
                        }}
                        className="px-2 py-0.5 rounded text-[9px] text-gray-600 hover:text-red-400 border border-gray-800/50 transition-colors"
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview player area */}
        <div className="flex-1 flex flex-col p-3 gap-2 min-w-0">
          {selectedTrack ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayPause}
                  disabled={!apiReady}
                  className="btn-neon px-3 py-1 rounded text-[10px] font-bold tracking-wider disabled:opacity-40"
                >
                  {isPlaying ? '⏸ PAUSA' : '▶ ANTEPRIMA'}
                </button>
                <span className="text-[10px] text-gray-500 truncate">{selectedTrack.title}</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-purple-900/30 flex-1" style={{ minHeight: 120 }}>
                <div id={playerDivId} style={{ width: '100%', height: '100%', minHeight: 120 }} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
              <span className="text-3xl">▶</span>
              <span className="text-[10px] text-gray-500 text-center">Seleziona un brano dalla lista<br />o aggiungi un URL YouTube sopra</span>
            </div>
          )}
        </div>
      </div>

      {!apiReady && (
        <div className="px-4 py-1 text-[10px] text-yellow-600 border-t border-yellow-900/20">
          ⏳ Caricamento API YouTube…
        </div>
      )}
    </div>
  );
}
