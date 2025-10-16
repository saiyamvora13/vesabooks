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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      await apiRequest('PUT', `/api/storybooks/${storybookId}/audio-settings`, updates);
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

  const AudioControlsContent = () => (
    <div className="space-y-4 px-1">
      <div className={`space-y-2 ${isMobile ? '' : ''}`}>
        <h4 className={`font-medium leading-none ${isMobile ? 'text-lg' : ''}`}>Audio Controls</h4>
        <p className="text-sm text-muted-foreground">
          Control music and sound effects for your storybook
        </p>
      </div>

      {/* Play/Pause Button */}
      <div className="flex items-center justify-between">
        <Label htmlFor="play-pause" className={`font-medium ${isMobile ? 'text-base' : 'text-sm'}`}>
          {isPlaying ? 'Pause Music' : 'Play Music'}
        </Label>
        <Button
          id="play-pause"
          variant="outline"
          size={isMobile ? "default" : "sm"}
          onClick={togglePlayPause}
          disabled={!musicEnabled}
          data-testid="button-play-pause"
          className={isMobile ? "min-h-[48px] px-4" : ""}
        >
          {isPlaying ? (
            <Pause className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
          ) : (
            <Play className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
          )}
        </Button>
      </div>

      {/* Music Enable Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="music-enabled" className={`font-medium ${isMobile ? 'text-base' : 'text-sm'}`}>
          Background Music
        </Label>
        <Switch
          id="music-enabled"
          checked={musicEnabled}
          onCheckedChange={handleMusicEnabledChange}
          data-testid="switch-music-enabled"
          className={isMobile ? "scale-125" : ""}
        />
      </div>

      {/* Music Volume Slider */}
      <div className={`space-y-${isMobile ? '3' : '2'}`}>
        <div className="flex items-center justify-between">
          <Label htmlFor="music-volume" className={`font-medium ${isMobile ? 'text-base' : 'text-sm'}`}>
            Music Volume
          </Label>
          <span className={`text-muted-foreground ${isMobile ? 'text-base font-semibold' : 'text-sm'}`}>{musicVolume}%</span>
        </div>
        <div className={isMobile ? "py-2" : ""}>
          <Slider
            id="music-volume"
            value={[musicVolume]}
            onValueChange={handleMusicVolumeChange}
            max={100}
            step={1}
            disabled={!musicEnabled}
            data-testid="slider-music-volume"
            className={isMobile ? "touch-none" : ""}
          />
        </div>
      </div>

      {/* Sound Effects Enable Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="effects-enabled" className={`font-medium ${isMobile ? 'text-base' : 'text-sm'}`}>
          Sound Effects
        </Label>
        <Switch
          id="effects-enabled"
          checked={soundEffectsEnabled}
          onCheckedChange={handleSoundEffectsEnabledChange}
          data-testid="switch-effects-enabled"
          className={isMobile ? "scale-125" : ""}
        />
      </div>

      {/* Sound Effects Volume Slider */}
      <div className={`space-y-${isMobile ? '3' : '2'}`}>
        <div className="flex items-center justify-between">
          <Label htmlFor="effects-volume" className={`font-medium ${isMobile ? 'text-base' : 'text-sm'}`}>
            Effects Volume
          </Label>
          <span className={`text-muted-foreground ${isMobile ? 'text-base font-semibold' : 'text-sm'}`}>{effectsVolume}%</span>
        </div>
        <div className={isMobile ? "py-2" : ""}>
          <Slider
            id="effects-volume"
            value={[effectsVolume]}
            onValueChange={handleEffectsVolumeChange}
            max={100}
            step={1}
            disabled={!soundEffectsEnabled}
            data-testid="slider-effects-volume"
            className={isMobile ? "touch-none" : ""}
          />
        </div>
      </div>

      <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>
        Music adapts to the story's mood as you turn pages
      </p>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            size="default"
            className="relative min-h-[48px] px-4"
            data-testid="button-audio-controls"
          >
            {musicEnabled ? <Music className="h-5 w-5 mr-2" /> : <VolumeX className="h-5 w-5 mr-2" />}
            <span className="sr-only md:not-sr-only">Audio</span>
            {isPlaying && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Audio Settings</DrawerTitle>
            <DrawerDescription>
              Adjust music and sound effects for your reading experience
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-8">
            <AudioControlsContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

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
        <AudioControlsContent />
      </PopoverContent>
    </Popover>
  );
}
