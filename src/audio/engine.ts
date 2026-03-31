import type { Track } from '../types';

interface DeckEngine {
  audioBuffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  pitchRate: number;
  startTime: number;
  startOffset: number;
  isPlaying: boolean;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  gainNodeEq: GainNode;
  compressor: DynamicsCompressorNode;
}

export function createAudioEngine() {
  const ctx = new AudioContext();
  const masterGain = ctx.createGain();
  const masterCompressor = ctx.createDynamicsCompressor();
  masterGain.connect(masterCompressor);
  masterCompressor.connect(ctx.destination);
  masterGain.gain.value = 0.9;

  const crossfadeA = ctx.createGain();
  const crossfadeB = ctx.createGain();
  crossfadeA.connect(masterGain);
  crossfadeB.connect(masterGain);

  function createDeckChain(): DeckEngine {
    const gainNode = ctx.createGain();
    const gainNodeEq = ctx.createGain();
    const eqLow = ctx.createBiquadFilter();
    const eqMid = ctx.createBiquadFilter();
    const eqHigh = ctx.createBiquadFilter();
    const compressor = ctx.createDynamicsCompressor();

    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 200;
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 4000;

    gainNode.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(gainNodeEq);
    gainNodeEq.connect(compressor);

    return { audioBuffer: null, source: null, gainNode, pitchRate: 1, startTime: 0, startOffset: 0, isPlaying: false, eqLow, eqMid, eqHigh, gainNodeEq, compressor };
  }

  const decks: { A: DeckEngine; B: DeckEngine } = { A: createDeckChain(), B: createDeckChain() };
  decks.A.compressor.connect(crossfadeA);
  decks.B.compressor.connect(crossfadeB);

  function resumeContext() { if (ctx.state === 'suspended') ctx.resume(); }

  function loadTrack(deckId: 'A' | 'B', track: Track) {
    const deck = decks[deckId];
    if (deck.source) { deck.source.stop(); deck.source = null; }
    deck.isPlaying = false; deck.startOffset = 0; deck.startTime = 0;
    if (track.audioBuffer) deck.audioBuffer = track.audioBuffer;
  }

  function createSource(deckId: 'A' | 'B') {
    const deck = decks[deckId];
    if (!deck.audioBuffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = deck.audioBuffer;
    source.playbackRate.value = deck.pitchRate;
    source.connect(deck.gainNode);
    source.onended = () => { if (deck.isPlaying) deck.isPlaying = false; };
    return source;
  }

  function play(deckId: 'A' | 'B') {
    resumeContext();
    const deck = decks[deckId];
    if (!deck.audioBuffer) return;
    if (deck.source) { try { deck.source.stop(); } catch (e) { /* ignore */ } }
    const source = createSource(deckId);
    if (!source) return;
    deck.source = source;
    deck.startTime = ctx.currentTime;
    source.start(0, deck.startOffset);
    deck.isPlaying = true;
  }

  function pause(deckId: 'A' | 'B') {
    const deck = decks[deckId];
    if (!deck.isPlaying || !deck.source) return;
    deck.startOffset += ctx.currentTime - deck.startTime;
    try { deck.source.stop(); } catch (e) { /* ignore */ }
    deck.source = null; deck.isPlaying = false;
  }

  function seekTo(deckId: 'A' | 'B', time: number) {
    const deck = decks[deckId];
    if (!deck.audioBuffer) return;
    const wasPlaying = deck.isPlaying;
    if (wasPlaying) { try { deck.source?.stop(); } catch (e) { /* ignore */ } deck.source = null; deck.isPlaying = false; }
    deck.startOffset = Math.max(0, Math.min(time, deck.audioBuffer.duration));
    if (wasPlaying) play(deckId);
  }

  function setCue(deckId: 'A' | 'B', time: number) { decks[deckId].startOffset = time; }
  function getCurrentTime(deckId: 'A' | 'B'): number {
    const deck = decks[deckId];
    if (!deck.audioBuffer) return 0;
    if (deck.isPlaying) return deck.startOffset + (ctx.currentTime - deck.startTime) * deck.pitchRate;
    return deck.startOffset;
  }
  function getDuration(deckId: 'A' | 'B'): number { return decks[deckId].audioBuffer?.duration ?? 0; }
  function setVolume(deckId: 'A' | 'B', volume: number) { decks[deckId].gainNode.gain.value = volume; }
  function setGain(deckId: 'A' | 'B', gain: number) { decks[deckId].gainNodeEq.gain.value = gain; }
  function setPitch(deckId: 'A' | 'B', pitch: number) {
    const rate = 1 + pitch / 100;
    decks[deckId].pitchRate = rate;
    if (decks[deckId].source) decks[deckId].source!.playbackRate.value = rate;
  }
  function setEq(deckId: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) {
    const deck = decks[deckId];
    const gain = value * 15;
    if (band === 'low') deck.eqLow.gain.value = gain;
    if (band === 'mid') deck.eqMid.gain.value = gain;
    if (band === 'high') deck.eqHigh.gain.value = gain;
  }
  function setCrossfader(value: number) {
    const angle = value * (Math.PI / 2);
    crossfadeA.gain.value = Math.cos(angle);
    crossfadeB.gain.value = Math.sin(angle);
  }
  function setMasterVolume(value: number) { masterGain.gain.value = value; }
  function getAnalyzer(deckId: 'A' | 'B'): AnalyserNode {
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 2048;
    decks[deckId].compressor.connect(analyzer);
    return analyzer;
  }
  async function loadAudioFile(file: File): Promise<AudioBuffer> {
    resumeContext();
    const arrayBuffer = await file.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer);
  }
  function getContext(): AudioContext { return ctx; }

  setCrossfader(0.5);

  return { loadTrack, play, pause, seekTo, setCue, getCurrentTime, getDuration, setVolume, setGain, setPitch, setEq, setCrossfader, setMasterVolume, getAnalyzer, loadAudioFile, getContext };
}

export type AudioEngine = ReturnType<typeof createAudioEngine>;
