"use client";

import { Howl, Howler } from "howler";
import type { MusicTrack, SFXType } from "./constants";

// Audio manager singleton
class AudioManager {
  private static instance: AudioManager;
  private bgMusic: Howl | null = null;
  private sfxCache: Map<SFXType, Howl> = new Map();
  private currentTrack: MusicTrack | null = null;
  private _isMuted: boolean = false;
  private _volume: number = 0.5;
  private initialized: boolean = false;

  private constructor() {
    // Load saved preferences
    if (typeof window !== "undefined") {
      const savedMuted = localStorage.getItem("dreamland_muted");
      const savedVolume = localStorage.getItem("dreamland_volume");
      if (savedMuted) this._isMuted = savedMuted === "true";
      if (savedVolume) this._volume = parseFloat(savedVolume);
      Howler.mute(this._isMuted);
      Howler.volume(this._volume);
    }
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // Initialize and preload audio
  async init(): Promise<void> {
    if (this.initialized) return;

    // Preload sound effects with synthesized audio
    this.preloadSFX();
    this.initialized = true;
  }

  private preloadSFX(): void {
    // Create simple synthesized sounds using Web Audio API via Howler
    // These are placeholder sounds - in production, use actual audio files

    // Click sound - short beep
    this.sfxCache.set(
      "click",
      new Howl({
        src: [this.createBeepDataUrl(440, 0.05)],
        volume: 0.3,
      })
    );

    // Stat up - rising tone
    this.sfxCache.set(
      "stat_up",
      new Howl({
        src: [this.createBeepDataUrl(523, 0.1)],
        volume: 0.4,
      })
    );

    // Stat down - falling tone
    this.sfxCache.set(
      "stat_down",
      new Howl({
        src: [this.createBeepDataUrl(262, 0.1)],
        volume: 0.4,
      })
    );

    // Close call - alarm
    this.sfxCache.set(
      "close_call",
      new Howl({
        src: [this.createBeepDataUrl(880, 0.3)],
        volume: 0.6,
      })
    );

    // Death - low tone
    this.sfxCache.set(
      "death",
      new Howl({
        src: [this.createBeepDataUrl(196, 0.5)],
        volume: 0.5,
      })
    );

    // Transition - sweep
    this.sfxCache.set(
      "transition",
      new Howl({
        src: [this.createBeepDataUrl(392, 0.15)],
        volume: 0.3,
      })
    );

    // Typewriter - tiny click
    this.sfxCache.set(
      "typewriter",
      new Howl({
        src: [this.createBeepDataUrl(1000, 0.02)],
        volume: 0.1,
      })
    );

    // Choice hover
    this.sfxCache.set(
      "choice_hover",
      new Howl({
        src: [this.createBeepDataUrl(600, 0.03)],
        volume: 0.2,
      })
    );
  }

  // Create a simple beep sound as a data URL
  private createBeepDataUrl(frequency: number, duration: number): string {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Simple square wave with decay
      const envelope = Math.exp(-t * 10);
      buffer[i] = Math.sign(Math.sin(2 * Math.PI * frequency * t)) * envelope * 0.3;
    }

    // Convert to WAV format
    const wavBuffer = this.encodeWAV(buffer, sampleRate);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    // Write samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return buffer;
  }

  playMusic(track: MusicTrack): void {
    if (track === this.currentTrack && this.bgMusic?.playing()) {
      return;
    }

    // Fade out current music
    if (this.bgMusic) {
      this.bgMusic.fade(this._volume, 0, 1000);
      const oldMusic = this.bgMusic;
      setTimeout(() => oldMusic.stop(), 1000);
    }

    // Create simple looping tone for background music
    // In production, use actual music files
    const frequencies: Record<MusicTrack, number> = {
      childhood: 523, // C5 - bright
      adult: 392, // G4 - neutral
      elder: 294, // D4 - mellow
      death: 196, // G3 - somber
    };

    this.bgMusic = new Howl({
      src: [this.createMusicDataUrl(frequencies[track])],
      loop: true,
      volume: 0,
    });

    this.currentTrack = track;
    this.bgMusic.play();
    this.bgMusic.fade(0, this._volume * 0.3, 2000);
  }

  private createMusicDataUrl(baseFreq: number): string {
    const sampleRate = 44100;
    const duration = 4; // 4 second loop
    const samples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Simple ambient tone with slight modulation
      const mod = Math.sin(2 * Math.PI * 0.5 * t) * 0.1;
      buffer[i] =
        Math.sin(2 * Math.PI * baseFreq * (1 + mod) * t) * 0.1 +
        Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.05;
    }

    const wavBuffer = this.encodeWAV(buffer, sampleRate);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }

  stopMusic(): void {
    if (this.bgMusic) {
      this.bgMusic.fade(this._volume, 0, 500);
      setTimeout(() => {
        this.bgMusic?.stop();
        this.bgMusic = null;
        this.currentTrack = null;
      }, 500);
    }
  }

  playSFX(type: SFXType): void {
    if (this._isMuted) return;
    const sound = this.sfxCache.get(type);
    if (sound) {
      sound.play();
    }
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  set isMuted(value: boolean) {
    this._isMuted = value;
    Howler.mute(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("dreamland_muted", String(value));
    }
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));
    Howler.volume(this._volume);
    if (typeof window !== "undefined") {
      localStorage.setItem("dreamland_volume", String(this._volume));
    }
  }

  fadeToTrack(track: MusicTrack, duration: number = 2000): void {
    this.playMusic(track);
  }
}

// Export singleton
export const audioManager = typeof window !== "undefined" ? AudioManager.getInstance() : null;

// Helper function to get the appropriate music track for an age
export function getMusicTrackForAge(age: number): MusicTrack {
  if (age <= 12) return "childhood";
  if (age <= 64) return "adult";
  return "elder";
}
