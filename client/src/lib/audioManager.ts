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

  // Generate synthetic ambient music using Web Audio API oscillators
  private generateSyntheticTrack(mood: MoodType): AudioBuffer | null {
    if (!this.audioContext) return null;

    // Define mood-based musical parameters
    const moodParams: Record<MoodType, { frequencies: number[], duration: number, waveType: OscillatorType }> = {
      calm: { frequencies: [220, 330, 440], duration: 8, waveType: 'sine' },
      adventure: { frequencies: [262, 392, 523], duration: 6, waveType: 'triangle' },
      mystery: { frequencies: [185, 277, 370], duration: 10, waveType: 'sine' },
      happy: { frequencies: [294, 440, 587], duration: 5, waveType: 'square' },
      suspense: { frequencies: [165, 247, 330], duration: 12, waveType: 'sawtooth' },
      dramatic: { frequencies: [196, 294, 392], duration: 7, waveType: 'triangle' },
    };

    const params = moodParams[mood];
    const sampleRate = this.audioContext.sampleRate;
    const duration = params.duration;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate a simple ambient tone by combining oscillators
    for (let i = 0; i < data.length; i++) {
      const time = i / sampleRate;
      let sample = 0;

      // Mix multiple frequencies for richer sound
      params.frequencies.forEach((freq, idx) => {
        const amplitude = 0.15 / params.frequencies.length; // Quiet ambient volume
        const phase = Math.PI * 2 * freq * time;
        
        // Add some variation based on wave type
        if (params.waveType === 'sine') {
          sample += amplitude * Math.sin(phase);
        } else if (params.waveType === 'triangle') {
          sample += amplitude * (2 / Math.PI) * Math.asin(Math.sin(phase));
        } else if (params.waveType === 'square') {
          sample += amplitude * Math.sign(Math.sin(phase));
        } else if (params.waveType === 'sawtooth') {
          sample += amplitude * (2 * ((freq * time) % 1) - 1);
        }
      });

      // Apply envelope for smooth looping
      const fadeTime = 0.5; // 500ms fade
      const fadeSamples = fadeTime * sampleRate;
      if (i < fadeSamples) {
        sample *= i / fadeSamples; // Fade in
      } else if (i > data.length - fadeSamples) {
        sample *= (data.length - i) / fadeSamples; // Fade out
      }

      data[i] = sample;
    }

    return buffer;
  }

  async loadTrack(mood: MoodType, url?: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const track = this.musicTracks.get(mood);
    if (!track) {
      throw new Error(`Invalid mood: ${mood}`);
    }

    try {
      if (url) {
        // Try to load from URL first
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        track.buffer = audioBuffer;
        console.log(`Loaded track for mood: ${mood} from URL`);
      } else {
        // Fallback to synthetic generation
        track.buffer = this.generateSyntheticTrack(mood);
        console.log(`Generated synthetic track for mood: ${mood}`);
      }
    } catch (error) {
      console.error(`Failed to load track for ${mood}, using synthetic:`, error);
      // Fallback to synthetic generation
      track.buffer = this.generateSyntheticTrack(mood);
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
    Array.from(this.musicTracks.values()).forEach(track => {
      if (track.source) {
        track.source.stop();
        track.source = null;
        track.isPlaying = false;
      }
    });

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
