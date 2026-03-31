# FABFIX DJ DCR

Professional web-based DJ application with a dual-deck interface, built with React, TypeScript, and the Web Audio API.

## Features

- **Dual Deck Interface** — two independent decks (A and B), each with:
  - Animated vinyl record display
  - Play / Pause, Cue, Set Cue, and Sync controls
  - Pitch slider (±12%)
  - Volume slider
  - 3-band EQ (High / Mid / Low) and Gain knobs
  - Real-time waveform display with playhead
  - BPM counter and track progress bar
- **Mixer** — crossfader and master volume control
- **Effects Panel** — per-deck audio effects powered by the Web Audio API
- **Automix** — automatic crossfade from Deck A to Deck B when the track is approaching the end
- **Music Library** — load local audio files and manage your track list
- **Neon UI** — dark theme with cyan (Deck A) and pink (Deck B) accent colours

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Audio | Web Audio API (custom engine in `src/audio/engine.ts`) |

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/lucadc86/fabfix-dj-dcr.git
cd fabfix-dj-dcr

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server with hot-reload |
| `npm run build` | Type-check and build for production (output in `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── audio/
│   └── engine.ts          # Web Audio API engine (play, pause, EQ, pitch, crossfader…)
├── components/
│   ├── AutomixPanel.tsx   # Automix toggle
│   ├── Deck.tsx           # Individual deck UI
│   ├── EffectsPanel.tsx   # Audio effects rack
│   ├── Knob.tsx           # Rotary knob control
│   ├── Library.tsx        # Track library and file loader
│   ├── Logo.tsx           # App logo
│   ├── Mixer.tsx          # Crossfader and master volume
│   └── WaveformDisplay.tsx# Waveform renderer
├── types/
│   └── index.ts           # Shared TypeScript types
├── App.tsx                # Root component and state management
└── main.tsx               # Entry point
```
