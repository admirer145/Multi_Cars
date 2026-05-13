export type AudioSettings = {
  soundEffects: boolean;
  music: boolean;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  soundEffects: true,
  music: false,
};

export function normalizeAudioSettings(settings?: Partial<AudioSettings> | null): AudioSettings {
  return {
    soundEffects: settings?.soundEffects ?? DEFAULT_AUDIO_SETTINGS.soundEffects,
    music: settings?.music ?? DEFAULT_AUDIO_SETTINGS.music,
  };
}
