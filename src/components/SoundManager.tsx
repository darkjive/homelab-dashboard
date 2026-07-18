import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export function SoundManager() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('sound-enabled');
    return saved !== 'false';
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('sound-volume');
    return saved ? parseFloat(saved) : 0.3;
  });

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;

      if (soundEnabled) {
        audioRef.current.play().catch(() => {
          // Autoplay blocked - silent
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [soundEnabled, volume]);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('sound-enabled', String(newState));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    localStorage.setItem('sound-volume', String(newVolume));
  };

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} loop preload="auto">
        <source src="/audio/ambiance-legal.ogg" type="audio/ogg" />
      </audio>

      <button
        onClick={toggleSound}
        className="p-2 hover:bg-cyber-cyan/10 rounded transition-all"
        title={soundEnabled ? 'Mute Ambiance' : 'Play Ambiance'}
      >
        {soundEnabled ? (
          <Volume2 className="w-5 h-5 text-cyber-cyan" />
        ) : (
          <VolumeX className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {soundEnabled && (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 accent-cyber-cyan"
          />
          <span className="text-xs text-gray-400 w-8">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
}
