type MoodType = 'calm' | 'adventure' | 'mystery' | 'happy' | 'suspense' | 'dramatic';

interface MusicTrack {
  buffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  isPlaying: boolean;
}

class AudioManager {
  private audioContext: AudioContext | null = null;
  private musicTracks: Map<MoodType, MusicTrack> = new Map();
  private soundEffects: Map<string, AudioBuffer> = new Map();
  private currentMood: MoodType | null = null;
  private masterGainNode: GainNode | null = null;
  private effectsGainNode: GainNode | null = null;
  private initialized = false;
  private isPaused = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create AudioContext (requires user interaction in most browsers)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create master gain nodes
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
      
      this.effectsGainNode = this.audioContext.createGain();
      this.effectsGainNode.connect(this.audioContext.destination);

      // Initialize track structures
      const moods: MoodType[] = ['calm', 'adventure', 'mystery', 'happy', 'suspense', 'dramatic'];
      for (const mood of moods) {
        const gainNode = this.audioContext.createGain();
        gainNode.connect(this.masterGainNode);
        gainNode.gain.value = 0; // Start silent
        
        this.musicTracks.set(mood, {
          buffer: null,
          source: null,
          gainNode,
          isPlaying: false,
        });
      }

      this.initialized = true;
      console.log('AudioManager initialized');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      throw error;
    }
  }

  async loadTrack(mood: MoodType, url: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const track = this.musicTracks.get(mood);
    if (!track) {
      throw new Error(`Invalid mood: ${mood}`);
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      track.buffer = audioBuffer;
      console.log(`Loaded track for mood: ${mood}`);
    } catch (error) {
      console.error(`Failed to load track for ${mood}:`, error);
      // Continue without this track - graceful degradation
    }
  }

  async loadSoundEffect(name: string, url: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.soundEffects.set(name, audioBuffer);
      console.log(`Loaded sound effect: ${name}`);
    } catch (error) {
      console.error(`Failed to load sound effect ${name}:`, error);
      // Continue without this effect - graceful degradation
    }
  }

  private createSource(track: MusicTrack): AudioBufferSourceNode | null {
    if (!this.audioContext || !track.buffer) return null;

    const source = this.audioContext.createBufferSource();
    source.buffer = track.buffer;
    source.loop = true;
    source.connect(track.gainNode);
    
    return source;
  }

  async crossfadeTo(newMood: MoodType, duration: number = 2): Promise<void> {
    if (!this.audioContext || !this.initialized) {
      console.warn('AudioManager not initialized, skipping crossfade');
      return;
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const newTrack = this.musicTracks.get(newMood);
    if (!newTrack || !newTrack.buffer) {
      console.warn(`Track not loaded for mood: ${newMood}`);
      return;
    }

    const currentTime = this.audioContext.currentTime;

    // If same mood, do nothing
    if (this.currentMood === newMood && newTrack.isPlaying) {
      return;
    }

    // Fade out current track
    if (this.currentMood) {
      const currentTrack = this.musicTracks.get(this.currentMood);
      if (currentTrack && currentTrack.isPlaying) {
        // Equal-power crossfade out
        currentTrack.gainNode.gain.setValueAtTime(currentTrack.gainNode.gain.value, currentTime);
        currentTrack.gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);
        
        // Stop the source after fade out
        setTimeout(() => {
          if (currentTrack.source) {
            currentTrack.source.stop();
            currentTrack.source = null;
            currentTrack.isPlaying = false;
          }
        }, duration * 1000 + 100);
      }
    }

    // Start new track if not already playing
    if (!newTrack.source || !newTrack.isPlaying) {
      newTrack.source = this.createSource(newTrack);
      if (newTrack.source) {
        newTrack.source.start(0);
        newTrack.isPlaying = true;
      }
    }

    // Fade in new track (equal-power crossfade)
    newTrack.gainNode.gain.setValueAtTime(0.01, currentTime);
    newTrack.gainNode.gain.exponentialRampToValueAtTime(1, currentTime + duration);

    this.currentMood = newMood;
  }

  playSoundEffect(name: string): void {
    if (!this.audioContext || !this.effectsGainNode) {
      console.warn('AudioManager not initialized');
      return;
    }

    const buffer = this.soundEffects.get(name);
    if (!buffer) {
      console.warn(`Sound effect not loaded: ${name}`);
      return;
    }

    // Resume AudioContext if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.effectsGainNode);
    source.start(0);
  }

  setMusicVolume(volume: number): void {
    if (!this.masterGainNode) return;
    
    // Volume is 0-100, convert to 0-1
    const gainValue = Math.max(0, Math.min(1, volume / 100));
    this.masterGainNode.gain.value = gainValue;
  }

  setSoundEffectsVolume(volume: number): void {
    if (!this.effectsGainNode) return;
    
    // Volume is 0-100, convert to 0-1
    const gainValue = Math.max(0, Math.min(1, volume / 100));
    this.effectsGainNode.gain.value = gainValue;
  }

  pause(): void {
    if (!this.audioContext || this.isPaused) return;
    
    this.audioContext.suspend();
    this.isPaused = true;
  }

  resume(): void {
    if (!this.audioContext || !this.isPaused) return;
    
    this.audioContext.resume();
    this.isPaused = false;
  }

  cleanup(): void {
    // Stop all playing tracks
    for (const [, track] of this.musicTracks) {
      if (track.source) {
        track.source.stop();
        track.source = null;
        track.isPlaying = false;
      }
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.initialized = false;
    this.currentMood = null;
    this.isPaused = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentMood(): MoodType | null {
    return this.currentMood;
  }
}

export const audioManager = new AudioManager();
