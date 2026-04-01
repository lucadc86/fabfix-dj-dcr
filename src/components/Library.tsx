import { useRef, useCallback, useState } from 'react';
import type { Track } from '../types';

interface LibraryProps {
  tracks: Track[];
  onAddTracks: (tracks: Track[]) => void;
  onLoadToDeck: (deckId: 'A' | 'B', track: Track) => void;
  onRemoveTrack: (trackId: string) => void;
  deckATrack: Track | null;
  deckBTrack: Track | null;
}

function trackColor(index: number): string {
  const colors = ['#b44fff', '#00f5ff', '#ff2d78', '#39ff14', '#ffa500', '#ff6b6b', '#4ecdc4'];
  return colors[index % colors.length];
}

function detectBpm(audioBuffer: AudioBuffer): number {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  // Analyze first 60 seconds max
  const maxSamples = Math.min(data.length, sampleRate * 60);
  // Frame size ~23ms for energy analysis
  const frameSize = Math.floor(sampleRate * 0.023);
  const energies: number[] = [];
  for (let i = 0; i < maxSamples - frameSize; i += frameSize) {
    let e = 0;
    for (let j = 0; j < frameSize; j++) e += data[i + j] * data[i + j];
    energies.push(e / frameSize);
  }
  if (energies.length < 4) return 0;
  // Onset detection: positive energy differences
  const onsets: number[] = energies.map((e, i) => i === 0 ? 0 : Math.max(0, e - energies[i - 1]));
  const mean = onsets.reduce((a, b) => a + b, 0) / onsets.length;
  const threshold = mean * 2.5;
  const minGap = Math.floor(sampleRate * 0.25 / frameSize); // min 250ms between beats
  const peaks: number[] = [];
  let lastPeak = -minGap;
  for (let i = 1; i < onsets.length - 1; i++) {
    if (onsets[i] > onsets[i - 1] && onsets[i] > onsets[i + 1] && onsets[i] > threshold && i - lastPeak > minGap) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  if (peaks.length < 4) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const secs = (peaks[i] - peaks[i - 1]) * frameSize / sampleRate;
    const bpm = Math.round(60 / secs);
    if (bpm >= 60 && bpm <= 200) intervals.push(bpm);
  }
  if (intervals.length === 0) return 0;
  const counts: Record<number, number> = {};
  for (const bpm of intervals) {
    const key = Math.round(bpm / 2) * 2; // bucket into 2-BPM bins
    counts[key] = (counts[key] || 0) + 1;
  }
  let best = 0, bestCount = 0;
  for (const [k, c] of Object.entries(counts)) {
    if (c > bestCount) { bestCount = c; best = parseInt(k); }
  }
  return best || Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Library({ tracks, onAddTracks, onLoadToDeck, onRemoveTrack, deckATrack, deckBTrack }: LibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const processFiles = useCallback(async (files: FileList) => {
    setLoading(true);
    const audioCtx = new AudioContext();
    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('audio/')) continue;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);
        const samples = 800;
        const blockSize = Math.floor(rawData.length / samples);
        const waveformData = new Float32Array(samples);
        for (let j = 0; j < samples; j++) {
          const start = j * blockSize;
          let max = 0;
          for (let k = 0; k < blockSize; k++) max = Math.max(max, Math.abs(rawData[start + k] || 0));
          waveformData[j] = max;
        }
        newTracks.push({ id: `${Date.now()}-${i}`, title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Artista Sconosciuto', duration: audioBuffer.duration, bpm: detectBpm(audioBuffer), file, audioBuffer, waveformData, color: trackColor(tracks.length + newTracks.length) });
      } catch (e) { console.error('Failed to decode audio:', file.name, e); }
    }
    await audioCtx.close();
    onAddTracks(newTracks);
    setLoading(false);
  }, [tracks.length, onAddTracks]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) processFiles(e.target.files); }, [processFiles]);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) processFiles(e.dataTransfer.files); }, [processFiles]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);

  const filteredTracks = searchQuery.trim()
    ? tracks.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tracks;

  return (
    <div className={`neon-border rounded-xl rounded-tl-none overflow-hidden h-full flex flex-col transition-all ${isDragging ? 'border-purple-500' : ''}`} style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)', minHeight: 120 }} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-purple-900/30">
        <button onClick={() => fileInputRef.current?.click()} className="btn-neon px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider flex-shrink-0" disabled={loading}>{loading ? '⏳ CARICAMENTO...' : '+ AGGIUNGI FILE'}</button>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileInput} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Cerca brani..."
          className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-gray-700 outline-none border border-purple-900/30 rounded px-2 py-1 focus:border-purple-600/60 transition-colors"
        />
        <span className="text-[10px] text-gray-600 flex-shrink-0">
          {tracks.length === 0
            ? 'Trascina file audio o clicca Aggiungi File'
            : searchQuery.trim()
              ? `${filteredTracks.length}/${tracks.length} brani`
              : `${tracks.length} brano${tracks.length === 1 ? '' : 'i'}`}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-50">
            <div className="text-3xl">{isDragging ? '🎵' : '📂'}</div>
            <span className="text-xs text-gray-500">{isDragging ? 'Rilascia per aggiungere brani' : 'Nessun brano caricato'}</span>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-50">
            <div className="text-3xl">🔍</div>
            <span className="text-xs text-gray-500">Nessun brano corrisponde alla ricerca</span>
          </div>
        ) : (
          <div className="divide-y divide-purple-900/10">
            {filteredTracks.map((track, i) => {
              const isOnA = deckATrack?.id === track.id;
              const isOnB = deckBTrack?.id === track.id;
              return (
                <div key={track.id} className="flex items-center gap-2 px-3 py-2 transition-all hover:bg-purple-900/10 group" onDoubleClick={() => onLoadToDeck('A', track)}>
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: track.color, boxShadow: `0 0 4px ${track.color}` }} />
                  <span className="text-[10px] text-gray-700 w-4 flex-shrink-0 font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{track.title}</div>
                    <div className="text-[10px] text-gray-600 truncate">{track.artist}</div>
                  </div>
                  <span className="text-[10px] font-mono text-purple-600 w-12 text-right flex-shrink-0">{track.bpm > 0 ? `${track.bpm}` : '--'} BPM</span>
                  <span className="text-[10px] font-mono text-gray-600 w-10 text-right flex-shrink-0">{formatDuration(track.duration)}</span>
                  {/* Always-visible load buttons */}
                  <button
                    onClick={e => { e.stopPropagation(); onLoadToDeck('A', track); }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex-shrink-0"
                    style={isOnA
                      ? { background: 'rgba(0,245,255,0.25)', border: '1px solid rgba(0,245,255,0.6)', color: '#00f5ff' }
                      : { background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.2)', color: '#00f5ff' }}
                    title="Carica su Deck A"
                  >A</button>
                  <button
                    onClick={e => { e.stopPropagation(); onLoadToDeck('B', track); }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex-shrink-0"
                    style={isOnB
                      ? { background: 'rgba(255,45,120,0.25)', border: '1px solid rgba(255,45,120,0.6)', color: '#ff2d78' }
                      : { background: 'rgba(255,45,120,0.06)', border: '1px solid rgba(255,45,120,0.2)', color: '#ff2d78' }}
                    title="Carica su Deck B"
                  >B</button>
                  {/* Delete button (visible on hover) */}
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveTrack(track.id); }}
                    className="px-1.5 py-0.5 rounded text-[9px] transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                    style={{ color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)' }}
                    title="Rimuovi brano"
                  >✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
