import { useState, useEffect } from "react";
import { Volume2, VolumeX, Music, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { audioManager } from "@/lib/audioManager";
import { apiRequest } from "@/lib/queryClient";

interface AudioControlsProps {
  storybookId: string;
}

export function AudioControls({ storybookId }: AudioControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(70);
  const [effectsVolume, setEffectsVolume] = useState(80);
  const [isOpen, setIsOpen] = useState(false);

  // Load audio settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(`/api/storybooks/${storybookId}/audio-settings`);
        if (response.ok) {
          const settings = await response.json();
          if (settings) {
            setMusicEnabled(settings.musicEnabled);
            setSoundEffectsEnabled(settings.soundEffectsEnabled);
            setMusicVolume(parseInt(settings.musicVolume));
            setEffectsVolume(parseInt(settings.effectsVolume));
            
            // Apply to audio manager
            audioManager.setMusicVolume(parseInt(settings.musicVolume));
            audioManager.setSoundEffectsVolume(parseInt(settings.effectsVolume));
          }
        }
      } catch (error) {
        console.error('Failed to load audio settings:', error);
      }
    };

    loadSettings();
  }, [storybookId]);

  // Save settings to backend
  const saveSettings = async (updates: Partial<{
    musicEnabled: boolean;
    soundEffectsEnabled: boolean;
    musicVolume: string;
    effectsVolume: string;
  }>) => {
    try {
      await apiRequest(`/api/storybooks/${storybookId}/audio-settings`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Failed to save audio settings:', error);
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      audioManager.pause();
      setIsPlaying(false);
    } else {
      audioManager.resume();
      setIsPlaying(true);
    }
  };

  const handleMusicVolumeChange = (value: number[]) => {
    const vol = value[0];
    setMusicVolume(vol);
    audioManager.setMusicVolume(vol);
    saveSettings({ musicVolume: vol.toString() });
  };

  const handleEffectsVolumeChange = (value: number[]) => {
    const vol = value[0];
    setEffectsVolume(vol);
    audioManager.setSoundEffectsVolume(vol);
    saveSettings({ effectsVolume: vol.toString() });
  };

  const handleMusicEnabledChange = (checked: boolean) => {
    setMusicEnabled(checked);
    if (!checked) {
      audioManager.pause();
      setIsPlaying(false);
    }
    saveSettings({ musicEnabled: checked });
  };

  const handleSoundEffectsEnabledChange = (checked: boolean) => {
    setSoundEffectsEnabled(checked);
    saveSettings({ soundEffectsEnabled: checked });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          data-testid="button-audio-controls"
        >
          {musicEnabled ? <Music className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {isPlaying && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Audio Controls</h4>
            <p className="text-sm text-muted-foreground">
              Control music and sound effects for your storybook
            </p>
          </div>

          {/* Play/Pause Button */}
          <div className="flex items-center justify-between">
            <Label htmlFor="play-pause" className="text-sm font-medium">
              {isPlaying ? 'Pause Music' : 'Play Music'}
            </Label>
            <Button
              id="play-pause"
              variant="outline"
              size="sm"
              onClick={togglePlayPause}
              disabled={!musicEnabled}
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Music Enable Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="music-enabled" className="text-sm font-medium">
              Background Music
            </Label>
            <Switch
              id="music-enabled"
              checked={musicEnabled}
              onCheckedChange={handleMusicEnabledChange}
              data-testid="switch-music-enabled"
            />
          </div>

          {/* Music Volume Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="music-volume" className="text-sm font-medium">
                Music Volume
              </Label>
              <span className="text-sm text-muted-foreground">{musicVolume}%</span>
            </div>
            <Slider
              id="music-volume"
              value={[musicVolume]}
              onValueChange={handleMusicVolumeChange}
              max={100}
              step={1}
              disabled={!musicEnabled}
              data-testid="slider-music-volume"
            />
          </div>

          {/* Sound Effects Enable Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="effects-enabled" className="text-sm font-medium">
              Sound Effects
            </Label>
            <Switch
              id="effects-enabled"
              checked={soundEffectsEnabled}
              onCheckedChange={handleSoundEffectsEnabledChange}
              data-testid="switch-effects-enabled"
            />
          </div>

          {/* Sound Effects Volume Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="effects-volume" className="text-sm font-medium">
                Effects Volume
              </Label>
              <span className="text-sm text-muted-foreground">{effectsVolume}%</span>
            </div>
            <Slider
              id="effects-volume"
              value={[effectsVolume]}
              onValueChange={handleEffectsVolumeChange}
              max={100}
              step={1}
              disabled={!soundEffectsEnabled}
              data-testid="slider-effects-volume"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Music adapts to the story's mood as you turn pages
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
