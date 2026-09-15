import { useEffect, useState } from "react";
import { Download, Volume2, VolumeX, Vibrate, VibrateOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audioMuted, applyStoredMute, setAudioMuted, unlockAudio } from "@/game/audio";
import { hapticsOn, hapticsSupported, setHaptics } from "@/game/haptics";

/** Chrome's install prompt event — not in lib.dom, so it is declared where it is used. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * The honesty controls: sound, haptics, and the install affordance.
 *
 * All three are the kind of thing a player wants to find in the first ten seconds, so they
 * live on the title screen rather than behind a settings route. Choices persist, and the
 * install button appears only when the browser actually offers an install (otherwise it
 * points at the platform's own install tutorial rather than pretending to be one).
 */
export function JuiceControls({ className }: { className?: string }) {
  const [muted, setMuted] = useState(false);
  const [buzzOn, setBuzzOn] = useState(false);
  const [buzzAvailable, setBuzzAvailable] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setMuted(audioMuted());
    setBuzzAvailable(hapticsSupported());
    setBuzzOn(hapticsOn());
    // Apply a stored mute before any cue can fire, so a muted player never gets one blip.
    applyStoredMute();

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const toggleSound = () => {
    unlockAudio();
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
  };

  const toggleBuzz = () => {
    const next = !buzzOn;
    setHaptics(next);
    setBuzzOn(next);
  };

  const install = async () => {
    if (!installEvent) {
      // No native prompt (iOS Safari, or already installed): the platform serves a tutorial.
      window.location.assign("/?install=1");
      return;
    }
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={toggleSound} aria-pressed={!muted}>
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          {muted ? "Sound off" : "Sound on"}
        </Button>
        {buzzAvailable && (
          <Button size="sm" variant="ghost" onClick={toggleBuzz} aria-pressed={buzzOn}>
            {buzzOn ? <Vibrate className="size-4" /> : <VibrateOff className="size-4" />}
            {buzzOn ? "Haptics on" : "Haptics off"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={install}>
          <Download className="size-4" />
          Install app
        </Button>
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">
        Install once — it keeps its place on the shelf, and the draft room keeps its place in your hand.
      </p>
    </div>
  );
}
