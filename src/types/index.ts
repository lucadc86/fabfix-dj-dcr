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
