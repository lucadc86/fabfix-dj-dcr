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

interface EffectNodes {
  filter: { node: BiquadFilterNode; wet: GainNode; dry: GainNode };
  echo: { delay: DelayNode; feedback: GainNode; wet: GainNode; dry: GainNode };
  reverb: { convolver: ConvolverNode; wet: GainNode; dry: GainNode };
  flanger: { delay: DelayNode; lfo: OscillatorNode; lfoGain: GainNode; wet: GainNode; dry: GainNode };
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

  // Effects bus (master chain): crossfadeA/B → effectsInput → effectsOutput → masterGain
  const effectsInput = ctx.createGain();
  const effectsOutput = ctx.createGain();
  crossfadeA.connect(effectsInput);
  crossfadeB.connect(effectsInput);
  effectsOutput.connect(masterGain);

  // Build effects chain nodes
  function buildEffects(): EffectNodes {
    // --- Filter ---
    const filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 20000;
    filterNode.Q.value = 1;
    const filterWet = ctx.createGain();
    const filterDry = ctx.createGain();
    filterWet.gain.value = 0;
    filterDry.gain.value = 1;

    // --- Echo ---
    const echoDelay = ctx.createDelay(2.0);
    echoDelay.delayTime.value = 0.3;
    const echoFeedback = ctx.createGain();
    echoFeedback.gain.value = 0.4;
    const echoWet = ctx.createGain();
    const echoDry = ctx.createGain();
    echoWet.gain.value = 0;
    echoDry.gain.value = 1;
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);

    // --- Reverb (synthetic impulse) ---
    const reverbConvolver = ctx.createConvolver();
    const reverbWet = ctx.createGain();
    const reverbDry = ctx.createGain();
    reverbWet.gain.value = 0;
    reverbDry.gain.value = 1;
    // Generate synthetic impulse response
    const irLen = ctx.sampleRate * 2;
    const irBuffer = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = irBuffer.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
      }
    }
    reverbConvolver.buffer = irBuffer;

    // --- Flanger ---
    const flangerDelay = ctx.createDelay(0.02);
    flangerDelay.delayTime.value = 0.005;
    const flangerLfo = ctx.createOscillator();
    flangerLfo.frequency.value = 0.5;
    flangerLfo.type = 'sine';
    const flangerLfoGain = ctx.createGain();
    flangerLfoGain.gain.value = 0.003;
    flangerLfo.connect(flangerLfoGain);
    flangerLfoGain.connect(flangerDelay.delayTime);
    flangerLfo.start();
    const flangerWet = ctx.createGain();
    const flangerDry = ctx.createGain();
    flangerWet.gain.value = 0;
    flangerDry.gain.value = 1;

    return {
      filter: { node: filterNode, wet: filterWet, dry: filterDry },
      echo: { delay: echoDelay, feedback: echoFeedback, wet: echoWet, dry: echoDry },
      reverb: { convolver: reverbConvolver, wet: reverbWet, dry: reverbDry },
      flanger: { delay: flangerDelay, lfo: flangerLfo, lfoGain: flangerLfoGain, wet: flangerWet, dry: flangerDry },
    };
  }

  const fx = buildEffects();

  // Wire effects chain: effectsInput → [dry+wet parallel for each effect] → effectsOutput
  // Chain: effectsInput → filter(dry/wet) → echo(dry/wet) → reverb(dry/wet) → flanger(dry/wet) → effectsOutput
  const chainNodes: GainNode[] = [];
  function buildChainNode() { const g = ctx.createGain(); return g; }

  // Manual chain: effectsInput → splitFilter → splitEcho → splitReverb → splitFlanger → effectsOutput
  const postFilter = buildChainNode();
  const postEcho = buildChainNode();
  const postReverb = buildChainNode();

  // Filter
  effectsInput.connect(fx.filter.dry);
  effectsInput.connect(fx.filter.node);
  fx.filter.node.connect(fx.filter.wet);
  fx.filter.dry.connect(postFilter);
  fx.filter.wet.connect(postFilter);

  // Echo
  postFilter.connect(fx.echo.dry);
  postFilter.connect(fx.echo.delay);
  fx.echo.delay.connect(fx.echo.wet);
  fx.echo.dry.connect(postEcho);
  fx.echo.wet.connect(postEcho);

  // Reverb
  postEcho.connect(fx.reverb.dry);
  postEcho.connect(fx.reverb.convolver);
  fx.reverb.convolver.connect(fx.reverb.wet);
  fx.reverb.dry.connect(postReverb);
  fx.reverb.wet.connect(postReverb);

  // Flanger
  postReverb.connect(fx.flanger.dry);
  postReverb.connect(fx.flanger.delay);
  fx.flanger.delay.connect(fx.flanger.wet);
  fx.flanger.dry.connect(effectsOutput);
  fx.flanger.wet.connect(effectsOutput);

  chainNodes.push(postFilter, postEcho, postReverb);

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
    if (deck.source) { try { deck.source.stop(); } catch { /* ignore */ } }
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
    try { deck.source.stop(); } catch { /* ignore */ }
    deck.source = null; deck.isPlaying = false;
  }

  function seekTo(deckId: 'A' | 'B', time: number) {
    const deck = decks[deckId];
    if (!deck.audioBuffer) return;
    const wasPlaying = deck.isPlaying;
    if (wasPlaying) { try { deck.source?.stop(); } catch { /* ignore */ } deck.source = null; deck.isPlaying = false; }
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

  function getCrossfaderGains(): { A: number; B: number } {
    return { A: crossfadeA.gain.value, B: crossfadeB.gain.value };
  }

  function playDrumPad(padId: string) {
    resumeContext();
    const now = ctx.currentTime;
    switch (padId) {
      case 'kick': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(masterGain);
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
        break;
      }
      case 'snare': {
        const bufLen = Math.floor(ctx.sampleRate * 0.18);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource(); noise.buffer = buf;
        const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 800;
        const gain = ctx.createGain();
        noise.connect(filt); filt.connect(gain); gain.connect(masterGain);
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        noise.start(now); noise.stop(now + 0.2);
        break;
      }
      case 'clap': {
        for (let t = 0; t < 3; t++) {
          const bufLen = Math.floor(ctx.sampleRate * 0.04);
          const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
          const noise = ctx.createBufferSource(); noise.buffer = buf;
          const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1500;
          const gain = ctx.createGain();
          noise.connect(filt); filt.connect(gain); gain.connect(masterGain);
          const startT = now + t * 0.012;
          gain.gain.setValueAtTime(0.9, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.08);
          noise.start(startT); noise.stop(startT + 0.1);
        }
        break;
      }
      case 'hihat': {
        const bufLen = Math.floor(ctx.sampleRate * 0.06);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource(); noise.buffer = buf;
        const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 8000;
        const gain = ctx.createGain();
        noise.connect(filt); filt.connect(gain); gain.connect(masterGain);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        noise.start(now); noise.stop(now + 0.07);
        break;
      }
      case 'rimshot': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = 800;
        osc.connect(gain); gain.connect(masterGain);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now); osc.stop(now + 0.06);
        break;
      }
      case 'cash': {
        const bufLen = Math.floor(ctx.sampleRate * 0.5);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
        const src = ctx.createBufferSource(); src.buffer = buf;
        const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 3000; filt.Q.value = 5;
        const gain = ctx.createGain();
        src.connect(filt); filt.connect(gain); gain.connect(masterGain);
        gain.gain.setValueAtTime(0.8, now);
        src.start(now); src.stop(now + 0.5);
        break;
      }
      case 'gunshot': {
        const bufLen = Math.floor(ctx.sampleRate * 0.3);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
        const src = ctx.createBufferSource(); src.buffer = buf;
        const gain = ctx.createGain();
        src.connect(gain); gain.connect(masterGain);
        gain.gain.setValueAtTime(1.0, now);
        src.start(now); src.stop(now + 0.35);
        break;
      }
      case 'openhat': {
        const bufLen = Math.floor(ctx.sampleRate * 0.3);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
        const noise = ctx.createBufferSource(); noise.buffer = buf;
        const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 7000;
        const gain = ctx.createGain();
        noise.connect(filt); filt.connect(gain); gain.connect(masterGain);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        noise.start(now); noise.stop(now + 0.32);
        break;
      }
      default:
        break;
    }
  }

  function applyEffect(id: string, active: boolean, params: Record<string, number>) {
    switch (id) {
      case 'filter': {
        const cutoff = params.cutoff ?? 2000;
        const resonance = params.resonance ?? 1;
        fx.filter.node.frequency.setTargetAtTime(Math.max(20, Math.min(20000, cutoff)), ctx.currentTime, 0.01);
        fx.filter.node.Q.setTargetAtTime(resonance, ctx.currentTime, 0.01);
        fx.filter.wet.gain.setTargetAtTime(active ? 1 : 0, ctx.currentTime, 0.02);
        fx.filter.dry.gain.setTargetAtTime(active ? 0 : 1, ctx.currentTime, 0.02);
        break;
      }
      case 'echo': {
        const delayTime = params.delay ?? 0.3;
        const feedbackGain = params.feedback ?? 0.4;
        const wet = params.wet ?? 0.3;
        fx.echo.delay.delayTime.setTargetAtTime(delayTime, ctx.currentTime, 0.01);
        fx.echo.feedback.gain.setTargetAtTime(feedbackGain, ctx.currentTime, 0.01);
        fx.echo.wet.gain.setTargetAtTime(active ? wet : 0, ctx.currentTime, 0.02);
        fx.echo.dry.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
        break;
      }
      case 'reverb': {
        const wet = params.wet ?? 0.3;
        fx.reverb.wet.gain.setTargetAtTime(active ? wet : 0, ctx.currentTime, 0.02);
        fx.reverb.dry.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
        break;
      }
      case 'flanger': {
        const rate = params.rate ?? 0.5;
        const depth = params.depth ?? 0.5;
        const wet = active ? 0.7 : 0;
        fx.flanger.lfo.frequency.setTargetAtTime(rate, ctx.currentTime, 0.01);
        fx.flanger.lfoGain.gain.setTargetAtTime(depth * 0.005, ctx.currentTime, 0.01);
        fx.flanger.wet.gain.setTargetAtTime(wet, ctx.currentTime, 0.02);
        fx.flanger.dry.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
        break;
      }
      default:
        break;
    }
  }

  setCrossfader(0.5);

  return { loadTrack, play, pause, seekTo, setCue, getCurrentTime, getDuration, setVolume, setGain, setPitch, setEq, setCrossfader, setMasterVolume, getAnalyzer, loadAudioFile, getContext, getCrossfaderGains, applyEffect, playDrumPad };
}

export type AudioEngine = ReturnType<typeof createAudioEngine>;
