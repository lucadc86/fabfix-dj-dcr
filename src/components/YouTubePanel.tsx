import { useState, useEffect, useRef, useCallback } from 'react';

interface YTTrack {
  id: string;
  youtubeId: string;
  title: string;
}

interface YouTubePanelProps {
  onLoadToDeck: (deckId: 'A' | 'B', youtubeId: string, title: string) => void;
}

// Minimal YT IFrame API type declarations
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getVideoData(): { title: string; video_id: string };
  getDuration(): number;
  getCurrentTime(): number;
  getPlayerState(): number;
  setVolume(volume: number): void;
  destroy(): void;
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

let apiLoading = false;
let apiLoaded = false;
const apiReadyCallbacks: Array<() => void> = [];

function loadYouTubeAPI(onReady: () => void) {
  if (apiLoaded) { onReady(); return; }
  apiReadyCallbacks.push(onReady);
  if (apiLoading) return;
  apiLoading = true;
  window.onYouTubeIframeAPIReady = () => {
    apiLoaded = true;
    apiLoading = false;
    apiReadyCallbacks.forEach(cb => cb());
    apiReadyCallbacks.length = 0;
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

export default function YouTubePanel({ onLoadToDeck }: YouTubePanelProps) {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<YTTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<YTTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiReady, setApiReady] = useState(apiLoaded);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const playerDivId = 'yt-player-container';

  useEffect(() => {
    loadYouTubeAPI(() => setApiReady(true));
  }, []);

  const applyTrackTitle = useCallback((youtubeId: string, title: string) => {
    setTracks(prev => prev.map(t => t.youtubeId === youtubeId ? { ...t, title } : t));
    setSelectedTrack(prev => prev?.youtubeId === youtubeId ? { ...prev, title } : prev);
  }, []);

  const initPlayer = useCallback((videoId: string) => {
    if (!apiReady) return;
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      playerRef.current.playVideo();
      setIsPlaying(true);
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

  // Initialize or switch the player after React re-renders and the player div is in the DOM.
  useEffect(() => {
    if (!selectedTrack) {
      currentVideoIdRef.current = null;
      return;
    }
    if (!apiReady) return;
    const videoId = selectedTrack.youtubeId;
    if (currentVideoIdRef.current === videoId && playerRef.current) return;
    currentVideoIdRef.current = videoId;
    initPlayer(videoId);
  }, [selectedTrack, apiReady, initPlayer]);

  const handleAdd = useCallback(() => {
    setError('');
    const videoId = extractVideoId(urlInput);
    if (!videoId) { setError('Invalid YouTube URL. Please paste a valid YouTube link.'); return; }
    const alreadyExists = tracks.some(t => t.youtubeId === videoId);
    if (alreadyExists) { setError('This track is already in the list.'); return; }
    const newTrack: YTTrack = { id: `yt-${Date.now()}`, youtubeId: videoId, title: `YouTube – ${videoId}` };
    setTracks(prev => [...prev, newTrack]);
    setUrlInput('');
    setSelectedTrack(newTrack);
  }, [urlInput, tracks]);

  const handleSelectTrack = useCallback((track: YTTrack) => {
    setSelectedTrack(track);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    const state = playerRef.current.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) { playerRef.current.pauseVideo(); }
    else { playerRef.current.playVideo(); }
  }, []);

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
          placeholder="Paste YouTube link (e.g. https://youtu.be/...)"
          className="flex-1 bg-transparent text-xs text-white placeholder-gray-700 outline-none border border-purple-900/30 rounded px-2 py-1 focus:border-purple-600/60 transition-colors"
        />
        <button onClick={handleAdd} className="btn-neon px-3 py-1.5 rounded text-[10px] font-bold tracking-wider flex-shrink-0">+ ADD</button>
      </div>

      {error && (
        <div className="px-4 py-1 text-[10px] text-red-400 border-b border-red-900/20">{error}</div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Track list */}
        <div className="w-48 flex-shrink-0 border-r border-purple-900/20 overflow-y-auto">
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-1 opacity-40 px-3">
              <span className="text-2xl">▶</span>
              <span className="text-[10px] text-gray-500 text-center">No YouTube tracks.<br />Paste a URL above.</span>
            </div>
          ) : (
            <div className="divide-y divide-purple-900/10">
              {tracks.map(track => {
                const isSelected = selectedTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`px-3 py-2 cursor-pointer transition-all hover:bg-purple-900/10 ${isSelected ? 'bg-purple-900/20' : ''}`}
                    onClick={() => handleSelectTrack(track)}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[9px] text-red-400 font-bold">YT</span>
                      <span className="text-[10px] text-white truncate">{track.title}</span>
                    </div>
                    {isSelected && (
                      <div className="flex gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); onLoadToDeck('A', track.youtubeId, track.title); }}
                          className="btn-cue px-2 py-0.5 rounded text-[9px] font-bold"
                        >A</button>
                        <button
                          onClick={e => { e.stopPropagation(); onLoadToDeck('B', track.youtubeId, track.title); }}
                          className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
                          style={{ background: 'rgba(255,45,120,0.1)', border: '1px solid rgba(255,45,120,0.3)', color: '#ff2d78' }}
                        >B</button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (isSelected) {
                              playerRef.current?.stopVideo();
                              setSelectedTrack(null);
                              setIsPlaying(false);
                            }
                            setTracks(prev => prev.filter(t => t.id !== track.id));
                          }}
                          className="px-2 py-0.5 rounded text-[9px] text-gray-600 hover:text-red-400 border border-gray-800/50 transition-colors"
                        >✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Player area */}
        <div className="flex-1 flex flex-col p-3 gap-2 min-w-0">
          {selectedTrack ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayPause}
                  disabled={!apiReady}
                  className="btn-neon px-3 py-1 rounded text-[10px] font-bold tracking-wider disabled:opacity-40"
                >
                  {isPlaying ? '⏸ PAUSA' : '▶ PLAY'}
                </button>
                <span className="text-[10px] text-gray-500 truncate">{selectedTrack.title}</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-purple-900/30 flex-1" style={{ minHeight: 120 }}>
                <div ref={playerContainerRef} id={playerDivId} style={{ width: '100%', height: '100%', minHeight: 120 }} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
              <span className="text-3xl">▶</span>
              <span className="text-[10px] text-gray-500">Select a track from the list or add a YouTube URL above</span>
            </div>
          )}
        </div>
      </div>

      {!apiReady && (
        <div className="px-4 py-1 text-[10px] text-yellow-600 border-t border-yellow-900/20">
          ⏳ Loading YouTube API…
        </div>
      )}
    </div>
  );
}
