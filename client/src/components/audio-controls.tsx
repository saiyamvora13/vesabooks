import { useState, useEffect } from "react";
import { VolumeX, Music } from "lucide-react";
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
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [effectsVolume, setEffectsVolume] = useState(80);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [savedVolume, setSavedVolume] = useState<number | null>(null);
  
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
            setSoundEffectsEnabled(settings.soundEffectsEnabled);
            const vol = parseInt(settings.effectsVolume);
            setEffectsVolume(vol);
            setSavedVolume(vol); // Cache for later application
          }
        }
      } catch (error) {
        console.error('Failed to load audio settings:', error);
      }
    };

    loadSettings();
  }, [storybookId]);

  // Apply saved volume once AudioManager initializes (poll until ready)
  useEffect(() => {
    if (savedVolume === null) return;

    const tryApplyVolume = () => {
      if (audioManager.isInitialized()) {
        audioManager.setSoundEffectsVolume(savedVolume);
        setSavedVolume(null); // Clear after applying
        return true;
      }
      return false;
    };

    // Try immediately
    if (tryApplyVolume()) return;

    // Poll every 100ms until initialized
    const interval = setInterval(() => {
      if (tryApplyVolume()) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [savedVolume]);

  // Save settings to backend
  const saveSettings = async (updates: Partial<{
    soundEffectsEnabled: boolean;
    effectsVolume: string;
  }>) => {
    try {
      await apiRequest('PUT', `/api/storybooks/${storybookId}/audio-settings`, updates);
    } catch (error) {
      console.error('Failed to save audio settings:', error);
    }
  };

  const handleEffectsVolumeChange = (value: number[]) => {
    const vol = value[0];
    setEffectsVolume(vol);
    if (audioManager.isInitialized()) {
      audioManager.setSoundEffectsVolume(vol);
    } else {
      // Cache for deferred application after initialization
      setSavedVolume(vol);
    }
    saveSettings({ effectsVolume: vol.toString() });
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
          Control sound effects for your storybook
        </p>
      </div>

      {/* Background music temporarily disabled */}

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
            {soundEffectsEnabled ? <Music className="h-5 w-5 mr-2" /> : <VolumeX className="h-5 w-5 mr-2" />}
            <span className="sr-only md:not-sr-only">Audio</span>
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Audio Settings</DrawerTitle>
            <DrawerDescription>
              Adjust sound effects for your reading experience
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
          {soundEffectsEnabled ? <Music className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <AudioControlsContent />
      </PopoverContent>
    </Popover>
  );
}
