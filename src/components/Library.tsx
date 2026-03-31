import { useRef, useCallback, useState } from 'react';
import type { Track } from '../types';
import YouTubePanel from './YouTubePanel';

interface LibraryProps {
  tracks: Track[];
  onAddTracks: (tracks: Track[]) => void;
  onLoadToDeck: (deckId: 'A' | 'B', track: Track) => void;
  onLoadYouTubeToDeck: (deckId: 'A' | 'B', youtubeId: string, title: string) => void;
  activeTab: 'library' | 'youtube';
  deckATrack: Track | null;
  deckBTrack: Track | null;
}

function trackColor(index: number): string {
  const colors = ['#b44fff', '#00f5ff', '#ff2d78', '#39ff14', '#ffa500', '#ff6b6b', '#4ecdc4'];
  return colors[index % colors.length];
}

function estimateBpm(): number {
  return Math.floor(Math.random() * 60) + 100;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Library({ tracks, onAddTracks, onLoadToDeck, onLoadYouTubeToDeck, activeTab, deckATrack, deckBTrack }: LibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

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
        newTracks.push({ id: `${Date.now()}-${i}`, title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Artista Sconosciuto', duration: audioBuffer.duration, bpm: estimateBpm(), file, audioBuffer, waveformData, color: trackColor(tracks.length + newTracks.length) });
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

  if (activeTab === 'youtube') {
    return <YouTubePanel onLoadToDeck={onLoadYouTubeToDeck} />;
  }

  return (
    <div className={`neon-border rounded-xl rounded-tl-none overflow-hidden h-full flex flex-col transition-all ${isDragging ? 'border-purple-500' : ''}`} style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #050508 100%)', minHeight: 120 }} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-purple-900/30">
        <button onClick={() => fileInputRef.current?.click()} className="btn-neon px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider" disabled={loading}>{loading ? '⏳ CARICAMENTO...' : '+ AGGIUNGI FILE'}</button>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileInput} />
        <span className="text-[10px] text-gray-600">{tracks.length === 0 ? 'Trascina file audio o clicca Aggiungi File' : `${tracks.length} brano${tracks.length === 1 ? '' : 'i'}`}</span>
        {selectedTrack && (
          <div className="flex gap-2 ml-auto">
            <button onClick={() => { const t = tracks.find(tr => tr.id === selectedTrack); if (t) onLoadToDeck('A', t); }} className="btn-cue px-3 py-1 rounded text-[10px] font-bold">CARICA → A</button>
            <button onClick={() => { const t = tracks.find(tr => tr.id === selectedTrack); if (t) onLoadToDeck('B', t); }} className="px-3 py-1 rounded text-[10px] font-bold transition-all" style={{ background: 'rgba(255,45,120,0.1)', border: '1px solid rgba(255,45,120,0.3)', color: '#ff2d78' }}>CARICA → B</button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-50">
            <div className="text-3xl">{isDragging ? '🎵' : '📂'}</div>
            <span className="text-xs text-gray-500">{isDragging ? 'Rilascia per aggiungere brani' : 'Nessun brano caricato'}</span>
          </div>
        ) : (
          <div className="divide-y divide-purple-900/10">
            {tracks.map((track, i) => {
              const isOnA = deckATrack?.id === track.id;
              const isOnB = deckBTrack?.id === track.id;
              const isSelected = selectedTrack === track.id;
              return (
                <div key={track.id} className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-all hover:bg-purple-900/10 ${isSelected ? 'bg-purple-900/20' : ''}`} onClick={() => setSelectedTrack(isSelected ? null : track.id)} onDoubleClick={() => onLoadToDeck('A', track)}>
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: track.color, boxShadow: `0 0 4px ${track.color}` }} />
                  <span className="text-[10px] text-gray-700 w-4 flex-shrink-0 font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{track.title}</div>
                    <div className="text-[10px] text-gray-600 truncate">{track.artist}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {isOnA && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(0,245,255,0.15)', color: '#00f5ff' }}>A</span>}
                    {isOnB && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(255,45,120,0.15)', color: '#ff2d78' }}>B</span>}
                  </div>
                  <span className="text-[10px] font-mono text-purple-600 w-12 text-right flex-shrink-0">{track.bpm} BPM</span>
                  <span className="text-[10px] font-mono text-gray-600 w-10 text-right flex-shrink-0">{formatDuration(track.duration)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
