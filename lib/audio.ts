"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

type SoundType = "select" | "hover" | "text" | "closeCall" | "death" | "statUp" | "statDown" | "transition";
type MusicTrack = "childhood" | "adult" | "elder" | "death";

interface AudioState {
  // Settings
  musicEnabled: boolean;
  soundEnabled: boolean;
  volume: number;

  // Internal state
  initialized: boolean;
  currentTrack: MusicTrack | null;

  // Actions
  initAudio: () => void;
  playSound: (sound: SoundType) => void;
  playMusic: (track: MusicTrack) => void;
  stopMusic: () => void;
  updateMusicForAge: (age: number) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

// ═══════════════════════════════════════════════
// WEB AUDIO HELPERS
// ═══════════════════════════════════════════════

let audioContext: AudioContext | null = null;
let musicGainNode: GainNode | null = null;
let currentMusicOscillator: OscillatorNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    musicGainNode = audioContext.createGain();
    musicGainNode.connect(audioContext.destination);
  }
  return audioContext;
}

function playBeep(frequency: number, duration: number, volume: number = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume audio context if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Quick attack, exponential decay
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function startBackgroundMusic(track: MusicTrack, volume: number): void {
  const ctx = getAudioContext();
  if (!ctx || !musicGainNode) return;

  // Stop existing music
  if (currentMusicOscillator) {
    currentMusicOscillator.stop();
    currentMusicOscillator = null;
  }

  // Resume audio context if suspended
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  // Create a simple ambient tone based on track
  const frequencies: Record<MusicTrack, number> = {
    childhood: 523.25, // C5
    adult: 392.0, // G4
    elder: 293.66, // D4
    death: 196.0, // G3
  };

  const oscillator = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const mainGain = ctx.createGain();

  // LFO for subtle tremolo
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.5, ctx.currentTime);
  lfoGain.gain.setValueAtTime(10, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(oscillator.frequency);

  // Main oscillator
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequencies[track], ctx.currentTime);
  oscillator.connect(mainGain);

  // Set volume low for ambient music
  mainGain.gain.setValueAtTime(volume * 0.1, ctx.currentTime);
  mainGain.connect(musicGainNode);

  lfo.start();
  oscillator.start();

  currentMusicOscillator = oscillator;
}

function stopBackgroundMusic(): void {
  if (currentMusicOscillator) {
    currentMusicOscillator.stop();
    currentMusicOscillator = null;
  }
}

// ═══════════════════════════════════════════════
// SOUND CONFIGS
// ═══════════════════════════════════════════════

const SOUND_CONFIG: Record<SoundType, { freq: number; duration: number; volume: number }> = {
  select: { freq: 440, duration: 0.08, volume: 0.3 },
  hover: { freq: 600, duration: 0.03, volume: 0.15 },
  text: { freq: 1000, duration: 0.015, volume: 0.08 },
  closeCall: { freq: 880, duration: 0.3, volume: 0.5 },
  death: { freq: 196, duration: 0.8, volume: 0.4 },
  statUp: { freq: 523, duration: 0.1, volume: 0.3 },
  statDown: { freq: 262, duration: 0.1, volume: 0.3 },
  transition: { freq: 392, duration: 0.15, volume: 0.25 },
};

// ═══════════════════════════════════════════════
// AUDIO STORE
// ═══════════════════════════════════════════════

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      // Initial state
      musicEnabled: false,
      soundEnabled: true,
      volume: 0.5,
      initialized: false,
      currentTrack: null,

      // Initialize audio
      initAudio: () => {
        if (get().initialized) return;

        // Try to create audio context (will be suspended until user interaction)
        getAudioContext();

        set({ initialized: true });
      },

      // Play sound effect
      playSound: (sound) => {
        const state = get();
        if (!state.soundEnabled || !state.initialized) return;

        const config = SOUND_CONFIG[sound];
        if (config) {
          playBeep(config.freq, config.duration, config.volume * state.volume);
        }
      },

      // Play music track
      playMusic: (track) => {
        const state = get();
        if (!state.musicEnabled || !state.initialized) return;

        if (track !== state.currentTrack) {
          startBackgroundMusic(track, state.volume);
          set({ currentTrack: track });
        }
      },

      // Stop music
      stopMusic: () => {
        stopBackgroundMusic();
        set({ currentTrack: null });
      },

      // Update music based on age
      updateMusicForAge: (age) => {
        const state = get();
        if (!state.musicEnabled) return;

        let track: MusicTrack;
        if (age <= 12) {
          track = "childhood";
        } else if (age <= 64) {
          track = "adult";
        } else {
          track = "elder";
        }

        if (track !== state.currentTrack) {
          get().playMusic(track);
        }
      },

      // Settings
      setMusicEnabled: (enabled) => {
        set({ musicEnabled: enabled });
        if (!enabled) {
          get().stopMusic();
        }
      },

      setSoundEnabled: (enabled) => {
        set({ soundEnabled: enabled });
      },

      setVolume: (volume) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        set({ volume: clampedVolume });

        // Update music volume if playing
        if (musicGainNode) {
          musicGainNode.gain.setValueAtTime(clampedVolume * 0.1, audioContext?.currentTime || 0);
        }
      },
    }),
    {
      name: "dreamland-audio-v2",
      partialize: (state) => ({
        musicEnabled: state.musicEnabled,
        soundEnabled: state.soundEnabled,
        volume: state.volume,
      }),
    }
  )
);
