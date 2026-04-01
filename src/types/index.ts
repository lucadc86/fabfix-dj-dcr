export interface YTPlayerInstance {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
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

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  file?: File;
  url?: string;
  youtubeId?: string;
  audioBuffer?: AudioBuffer;
  waveformData?: Float32Array;
  color: string;
}

export interface DeckState {
  id: 'A' | 'B';
  track: Track | null;
  isPlaying: boolean;
  volume: number;
  pitch: number;
  bpm: number;
  detectedBpm: number;
  cuePoint: number;
  currentTime: number;
  duration: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  eq: { low: number; mid: number; high: number };
  gain: number;
}

export interface MixerState {
  crossfader: number;
  masterVolume: number;
}

export interface Effect {
  id: string;
  name: string;
  active: boolean;
  params: Record<string, number>;
}
