import type { RoadSide } from "../core/types";
import { loadAudioSettings } from "../persistence/storage";

type ToneOptions = {
  frequency: number;
  endFrequency?: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  delay?: number;
};

type NoiseOptions = {
  duration: number;
  gain: number;
  frequency?: number;
  delay?: number;
};

let audioContext: AudioContext | undefined;
let masterGain: GainNode | undefined;
let musicTimer: number | undefined;
let musicStep = 0;
let musicIntensity = 0;

const SWITCH_PITCH: Record<RoadSide, number> = {
  left: 220,
  right: 278,
  third: 350,
  fourth: 440,
};

export function unlockAudio(): void {
  const context = getAudioContext();
  void context?.resume();
}

export function playUiClick(): void {
  if (!canPlayEffects()) return;
  playTone({ frequency: 660, endFrequency: 520, duration: 0.045, gain: 0.035, type: "triangle" });
}

export function playUiToggle(enabled: boolean): void {
  if (!canPlayEffects()) return;
  playTone({ frequency: enabled ? 520 : 360, endFrequency: enabled ? 760 : 260, duration: 0.075, gain: 0.04, type: "sine" });
}

export function playRunStart(carCount: number): void {
  if (!canPlayEffects()) return;
  playTone({ frequency: 392, duration: 0.08, gain: 0.045, type: "triangle" });
  playTone({ frequency: 494 + carCount * 18, duration: 0.09, gain: 0.045, type: "triangle", delay: 0.07 });
  playTone({ frequency: 659 + carCount * 16, duration: 0.12, gain: 0.055, type: "triangle", delay: 0.15 });
}

export function playLaneSwitch(side: RoadSide): void {
  if (!canPlayEffects()) return;
  const pitch = SWITCH_PITCH[side];
  playNoise({ duration: 0.055, gain: 0.025, frequency: 1_500 });
  playTone({ frequency: pitch, endFrequency: pitch * 1.42, duration: 0.06, gain: 0.034, type: "square" });
}

export function playCollectible(): void {
  if (!canPlayEffects()) return;
  playTone({ frequency: 820, endFrequency: 1_120, duration: 0.07, gain: 0.045, type: "sine" });
  playTone({ frequency: 1_540, duration: 0.06, gain: 0.022, type: "triangle", delay: 0.045 });
}

export function playPowerUp(): void {
  if (!canPlayEffects()) return;
  playTone({ frequency: 520, endFrequency: 920, duration: 0.14, gain: 0.045, type: "sine" });
  playTone({ frequency: 1_220, duration: 0.12, gain: 0.025, type: "triangle", delay: 0.05 });
}

export function playShieldHit(): void {
  if (!canPlayEffects()) return;
  playTone({ frequency: 160, endFrequency: 90, duration: 0.11, gain: 0.06, type: "sawtooth" });
  playNoise({ duration: 0.09, gain: 0.035, frequency: 580 });
}

export function playFailure(): void {
  if (!canPlayEffects()) return;
  stopMusic();
  playTone({ frequency: 120, endFrequency: 52, duration: 0.22, gain: 0.08, type: "sawtooth" });
  playNoise({ duration: 0.16, gain: 0.055, frequency: 260 });
}

export function playPauseSound(paused: boolean): void {
  if (!canPlayEffects()) return;
  playTone({
    frequency: paused ? 420 : 520,
    endFrequency: paused ? 240 : 760,
    duration: 0.085,
    gain: 0.035,
    type: "triangle",
  });
}

export function startMusic(): void {
  if (!loadAudioSettings().music || musicTimer !== undefined) {
    return;
  }

  unlockAudio();
  musicTimer = window.setInterval(playMusicPulse, 460);
}

export function stopMusic(): void {
  if (musicTimer === undefined) {
    return;
  }

  window.clearInterval(musicTimer);
  musicTimer = undefined;
  musicStep = 0;
}

export function setMusicIntensity(speedLevel: number): void {
  musicIntensity = Math.min(1, Math.max(0, (speedLevel - 1) / 36));
}

function playMusicPulse(): void {
  if (!loadAudioSettings().music) {
    stopMusic();
    return;
  }

  const root = musicStep % 4 === 0 ? 110 : 165;
  const accent = musicStep % 8 === 6;
  playTone({
    frequency: root + musicIntensity * 42,
    duration: 0.055,
    gain: accent ? 0.026 : 0.017,
    type: "triangle",
  });

  if (musicIntensity > 0.34 && musicStep % 2 === 1) {
    playNoise({ duration: 0.025, gain: 0.009 + musicIntensity * 0.012, frequency: 3_400 });
  }

  musicStep += 1;
}

function canPlayEffects(): boolean {
  return loadAudioSettings().soundEffects && Boolean(getAudioContext());
}

function getAudioContext(): AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.78;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

function playTone(options: ToneOptions): void {
  const context = getAudioContext();
  if (!context || !masterGain) return;

  const startAt = context.currentTime + (options.delay ?? 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, startAt);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, startAt + options.duration);
  }
  filter.type = "lowpass";
  filter.frequency.value = 3_200;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.gain, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + options.duration);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  oscillator.start(startAt);
  oscillator.stop(startAt + options.duration + 0.025);
}

function playNoise(options: NoiseOptions): void {
  const context = getAudioContext();
  if (!context || !masterGain) return;

  const startAt = context.currentTime + (options.delay ?? 0);
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * options.duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = options.frequency ?? 1_200;
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(options.gain, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + options.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(startAt);
  source.stop(startAt + options.duration + 0.02);
}
